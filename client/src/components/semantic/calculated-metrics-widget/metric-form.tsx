import { useMemo, useState } from 'react'
import { MeasureRegistry, measureToDef } from '@/lib/semantic-layer'
import type { ExpressionEngine } from '@/lib/semantic-layer'
import type { FieldCatalogEntry, FormatType, Measure, Row } from '@/lib/semantic-layer'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormulaEditor } from './formula-editor'
import { MetricPreview } from './metric-preview'

const FORMAT_TYPES: FormatType[] = ['number', 'currency', 'percent', 'date', 'text']

const FORMAT_TYPE_LABELS: Record<FormatType, string> = {
  number: 'Número',
  currency: 'Moneda',
  percent: 'Porcentaje',
  date: 'Fecha',
  text: 'Texto',
}

const NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/**
 * Sugiere marcar la metrica como "Nivel hoja" cuando la formula combina un
 * MIN/MAX con un SUM/COUNT/AVG sobre una columna distinta -- el patron
 * exacto que causa el bug de grano mezclado (ej. "SUM(remesa) -
 * MIN(flete)"). Es solo una pista, no un bloqueo: el usuario decide.
 */
function suggestsLeafKind(expression: string): boolean {
  const minMaxCols = [...expression.matchAll(/\b(?:MIN|MAX)\s*\(\s*([a-zA-Z_]\w*)\s*\)/gi)].map((m) =>
    m[1].toLowerCase()
  )
  const otherCols = [...expression.matchAll(/\b(?:SUM|COUNT|AVG)\s*\(\s*([a-zA-Z_]\w*)\s*\)/gi)].map((m) =>
    m[1].toLowerCase()
  )
  if (minMaxCols.length === 0 || otherCols.length === 0) return false
  return minMaxCols.some((c) => !otherCols.includes(c)) || otherCols.some((c) => !minMaxCols.includes(c))
}

interface MetricFormProps {
  initial: Measure | null
  fieldCatalog: FieldCatalogEntry[]
  engine: ExpressionEngine
  existingNames: string[]
  /** todas las medidas del modelo (base + calculadas), para validar dependencias de grano en vivo */
  allMeasures: Measure[]
  rows: Row[]
  previewDimension?: string
  onSave: (measure: Measure) => void
  onCancel: () => void
}

export function MetricForm({
  initial,
  fieldCatalog,
  engine,
  existingNames,
  allMeasures,
  rows,
  previewDimension,
  onSave,
  onCancel,
}: MetricFormProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [expression, setExpression] = useState(initial?.expression ?? '')
  const [formatType, setFormatType] = useState<FormatType>(initial?.format?.type ?? 'number')
  const [decimals, setDecimals] = useState(String(initial?.format?.decimals ?? 0))
  const [currency, setCurrency] = useState(initial?.format?.currency ?? 'USD')
  const [treeKind, setTreeKind] = useState<'derived' | 'leaf'>(initial?.treeKind ?? 'derived')
  const [combinator, setCombinator] = useState<'sum' | 'avg' | 'min' | 'max'>(
    initial?.combinator ?? 'sum'
  )

  const expressionError = useMemo(
    () => (expression.trim() ? engine.validate(expression) : null),
    [expression, engine]
  )

  const nameError = useMemo(() => {
    if (!name.trim()) return null
    if (!NAME_PATTERN.test(name)) {
      return 'Usa solo letras, números y guion bajo; no puede empezar con número.'
    }
    if (!isEdit && existingNames.includes(name)) {
      return 'Ya existe una métrica con ese nombre.'
    }
    return null
  }, [name, isEdit, existingNames])

  // Valida en vivo las reglas de grano entre tipos de metrica (misma regla
  // que aplica el motor de arbol al construir la Tabla dinamica), para que
  // el usuario vea el error al momento de elegir "Nivel hoja" en vez de que
  // la metrica quede silenciosamente descartada de la tabla despues.
  const treeKindError = useMemo(() => {
    if (!expression.trim() || expressionError) return null
    try {
      const registry = new MeasureRegistry(engine)
      for (const m of allMeasures) {
        if (isEdit && m.name === initial?.name) continue
        try {
          registry.register(measureToDef(m))
        } catch {
          // otra medida ya invalida en el modelo: no bloquea la validacion de esta
        }
      }
      registry.register(
        measureToDef({
          name: name.trim() || '__draft__',
          label: label.trim() || 'Vista previa',
          expression: expression.trim(),
          isCalculated: true,
          treeKind,
          combinator,
        })
      )
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, [expression, expressionError, treeKind, combinator, allMeasures, engine, name, label, isEdit, initial])

  // Sugerencia (no bloqueante): la formula mezcla MIN/MAX con SUM/COUNT/AVG
  // sobre columnas distintas -- el patron exacto que rompe al agrupar si se
  // deja en "Recalcular en cada nivel".
  const showLeafSuggestion = treeKind === 'derived' && !expressionError && suggestsLeafKind(expression)

  const canSave =
    name.trim() && label.trim() && expression.trim() && !nameError && !expressionError && !treeKindError

  const previewDraft: Measure | null = useMemo(() => {
    if (expressionError || !expression.trim()) return null
    return {
      name: name.trim() || 'preview',
      label: label.trim() || name.trim() || 'Vista previa',
      expression: expression.trim(),
      isCalculated: true,
      format: {
        type: formatType,
        decimals: formatType === 'date' || formatType === 'text' ? undefined : Number(decimals) || 0,
        currency: formatType === 'currency' ? currency.trim() || 'USD' : undefined,
      },
    }
  }, [name, label, expression, expressionError, formatType, decimals, currency])

  const handleSubmit = () => {
    if (!canSave) return
    const measure: Measure = {
      name: name.trim(),
      label: label.trim(),
      description: description.trim() || undefined,
      expression: expression.trim(),
      isCalculated: true,
      treeKind,
      combinator: treeKind === 'leaf' ? combinator : undefined,
      format: {
        type: formatType,
        decimals: formatType === 'date' || formatType === 'text' ? undefined : Number(decimals) || 0,
        currency: formatType === 'currency' ? currency.trim() || 'USD' : undefined,
      },
    }
    onSave(measure)
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='metric-name'>Nombre técnico</Label>
          <Input
            id='metric-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='margen'
            disabled={isEdit}
          />
          {nameError && <p className='text-destructive text-xs'>{nameError}</p>}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='metric-label'>Etiqueta</Label>
          <Input
            id='metric-label'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Margen'
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='metric-description'>
          Descripción <span className='text-muted-foreground'>(opcional)</span>
        </Label>
        <Input
          id='metric-description'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Utilidad sobre ingresos'
        />
      </div>

      <div className='space-y-2'>
        <Label>Fórmula</Label>
        <FormulaEditor
          value={expression}
          onChange={setExpression}
          fieldCatalog={fieldCatalog}
          error={expressionError}
        />
        {showLeafSuggestion && (
          <div className='flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs'>
            <Lightbulb className='mt-0.5 size-3.5 shrink-0 text-amber-600' />
            <div className='space-y-1.5'>
              <p>
                Esta fórmula combina <code className='font-mono'>MIN</code>/<code className='font-mono'>MAX</code>{' '}
                con <code className='font-mono'>SUM</code>/<code className='font-mono'>COUNT</code>/
                <code className='font-mono'>AVG</code> sobre columnas distintas. Si una de esas columnas se repite
                por fila (ej. un flete repetido por cada remesa del mismo manifiesto), recalcularla al agrupar da un
                resultado incorrecto. Considera marcarla como "Nivel hoja" abajo.
              </p>
              <Button type='button' size='sm' variant='outline' onClick={() => setTreeKind('leaf')}>
                Marcar como Nivel hoja
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className='grid grid-cols-3 gap-4'>
        <div className='space-y-2'>
          <Label>Formato</Label>
          <Select value={formatType} onValueChange={(v) => setFormatType(v as FormatType)}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {FORMAT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(formatType === 'number' || formatType === 'currency' || formatType === 'percent') && (
          <div className='space-y-2'>
            <Label htmlFor='metric-decimals'>Decimales</Label>
            <Input
              id='metric-decimals'
              type='number'
              min={0}
              max={6}
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
            />
          </div>
        )}
        {formatType === 'currency' && (
          <div className='space-y-2'>
            <Label htmlFor='metric-currency'>Moneda</Label>
            <Input
              id='metric-currency'
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder='USD'
            />
          </div>
        )}
      </div>

      <div className='space-y-2 rounded-md border p-3'>
        <Label>Agrupación en Tabla dinámica</Label>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1'>
            <Select value={treeKind} onValueChange={(v) => setTreeKind(v as 'derived' | 'leaf')}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='derived'>Recalcular en cada nivel</SelectItem>
                <SelectItem value='leaf'>Nivel hoja (calcular una vez y sumar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {treeKind === 'leaf' && (
            <div className='space-y-1'>
              <Select value={combinator} onValueChange={(v) => setCombinator(v as typeof combinator)}>
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='sum'>Sumar hojas</SelectItem>
                  <SelectItem value='avg'>Promediar hojas</SelectItem>
                  <SelectItem value='min'>Mínimo de las hojas</SelectItem>
                  <SelectItem value='max'>Máximo de las hojas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className='text-muted-foreground text-xs'>
          {treeKind === 'leaf'
            ? 'Se calcula una sola vez por fila hoja (ej. por manifiesto) y los grupos superiores suman ese resultado. Úsalo si tu fórmula mezcla columnas que se repiten a distinto nivel (ej. un flete que se repite por cada remesa del mismo manifiesto): "SUM(remesa) - MIN(flete)" da el margen correcto por manifiesto, pero recalcularlo en el cliente combinado da un número incorrecto.'
            : 'Se recalcula en cada nivel de la jerarquía usando los valores ya resueltos de otras métricas en ese mismo grupo. Úsalo para ratios/porcentajes (ej. "margen / remesa_total") o para fórmulas simples que ya son aditivas.'}
        </p>
        {treeKindError && (
          <div className='flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs'>
            <AlertTriangle className='mt-0.5 size-3.5 shrink-0 text-destructive' />
            <p className='text-destructive'>{treeKindError}</p>
          </div>
        )}
      </div>

      <MetricPreview draft={previewDraft} rows={rows} previewDimension={previewDimension} />

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!canSave}>
          Guardar
        </Button>
      </div>
    </div>
  )
}
