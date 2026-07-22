import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { biApi, type Connector } from '@/lib/bi-api'
import { listScalarCalculatedMeasureNames, peekConnectorSemanticModel, getConnectorSemanticModel, useModelVersion } from '@/lib/semantic-layer'
import {
  AGGREGATIONS,
  CHART_TYPES,
  dashboardApi,
  KINDS_REQUIRING_CONNECTOR,
  WIDGET_COLOR_CSS,
  WIDGET_COLORS,
  WIDGET_KINDS,
  type Aggregation,
  type ChartType,
  type Widget,
  type WidgetColor,
  type WidgetKind,
  type WidgetLayout,
} from '@/lib/dashboard-api'
import { cn } from '@/lib/utils'
import { type WidgetEditSuggestion, type WidgetSuggestion } from '@/lib/ai-api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_CONNECTOR_VALUE = '__none__'
const AUTO_VALUE = '__auto__'

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar chart',
  gradient_bar: 'Barras por escala de valor (calor)',
  line: 'Line chart',
  area: 'Area chart',
  pie: 'Pie chart',
  table: 'Table',
}

const WIDGET_KIND_LABELS: Record<WidgetKind, string> = {
  chart: 'Chart',
  stat: 'KPI card',
  combo: 'Combined chart',
  progress: 'Progress bars',
  map: 'Map',
  tree_grid: 'Analytical tree table',
  calendar: 'Calendar',
  clock: 'Clock',
  filter_date: 'Date filter',
  filter_select: 'Selection filter',
}

const WIDGET_COLOR_LABELS: Record<WidgetColor, string> = {
  primary: 'Default',
  pink: 'Pink',
  blue: 'Blue',
  green: 'Green',
  orange: 'Orange',
  purple: 'Purple',
  teal: 'Teal',
}

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Minimum',
  max: 'Maximum',
}

const DEFAULT_LAYOUT: Record<WidgetKind, WidgetLayout> = {
  chart: { x: 0, y: 0, w: 4, h: 6 },
  stat: { x: 0, y: 0, w: 3, h: 3 },
  combo: { x: 0, y: 0, w: 5, h: 7 },
  progress: { x: 0, y: 0, w: 4, h: 6 },
  map: { x: 0, y: 0, w: 6, h: 8 },
  tree_grid: { x: 0, y: 0, w: 6, h: 8 },
  calendar: { x: 0, y: 0, w: 4, h: 8 },
  clock: { x: 0, y: 0, w: 3, h: 3 },
  filter_date: { x: 0, y: 0, w: 3, h: 3 },
  filter_select: { x: 0, y: 0, w: 3, h: 3 },
}

// Kinds que tienen concepto de color (no aplica a reloj/calendario/filtros)
const KINDS_WITH_COLOR: WidgetKind[] = [
  'chart',
  'stat',
  'combo',
  'progress',
  'map',
  'tree_grid',
]

// Kinds que usan columnas X/Y (eje/categoria y valor)
const KINDS_WITH_XY: WidgetKind[] = ['chart', 'combo', 'progress', 'map']

// tree_grid guarda listas separadas por coma en xKey (agrupar por) / yKey
// (columnas de valor), reutilizando las mismas columnas de la BD sin agregar
// una tabla/columna nueva.
const KINDS_WITH_COLUMN_LISTS: WidgetKind[] = ['tree_grid']

/**
 * Selector de columna: si ya conocemos las columnas reales del conector
 * (via una muestra de datos), se muestran en un Select; si no, cae a un
 * input de texto libre (ej. conector aun no elegido, o el fetch fallo).
 */
function ColumnField({
  id,
  value,
  onChange,
  columns,
  columnsLoading,
  allowAuto,
  autoLabel,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  columns: string[]
  columnsLoading: boolean
  allowAuto?: boolean
  autoLabel: string
  placeholder: string
}) {
  if (columns.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={columnsLoading}
      />
    )
  }

  return (
    <Select
      value={value || (allowAuto ? AUTO_VALUE : '')}
      onValueChange={(v) => onChange(v === AUTO_VALUE ? '' : v)}
    >
      <SelectTrigger id={id} className='w-full'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAuto && <SelectItem value={AUTO_VALUE}>{autoLabel}</SelectItem>}
        {columns.map((col) => (
          <SelectItem key={col} value={col}>
            {col}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Selector multiple de columnas por checkboxes (agrupar-por / valores del
 * tree_grid): el orden de seleccion importa (define el orden de la jerarquia
 * o de las columnas de valor), por eso se guarda como array, no Set.
 */
function ColumnMultiSelect({
  values,
  onToggle,
  columns,
  columnsLoading,
  loadingText,
  emptyText,
}: {
  values: string[]
  onToggle: (column: string) => void
  columns: string[]
  columnsLoading: boolean
  loadingText: string
  emptyText: string
}) {
  if (columnsLoading) {
    return <p className='text-muted-foreground text-xs'>{loadingText}</p>
  }
  if (columns.length === 0) {
    return <p className='text-muted-foreground text-xs'>{emptyText}</p>
  }
  return (
    <div className='max-h-40 space-y-1 overflow-y-auto rounded-md border p-2'>
      {columns.map((col) => (
        <label key={col} className='flex cursor-pointer items-center gap-2 text-sm'>
          <Checkbox
            checked={values.includes(col)}
            onCheckedChange={() => onToggle(col)}
          />
          <span className='truncate'>{col}</span>
        </label>
      ))}
    </div>
  )
}

/**
 * Lista de las columnas ya elegidas (agrupar-por), en el orden en que se
 * aplican -- la primera es el nivel mas externo del arbol. Con las flechas se
 * reordena sin tener que desmarcar y volver a marcar en otro orden.
 */
function OrderedColumnList({
  values,
  onMove,
  onRemove,
}: {
  values: string[]
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (column: string) => void
}) {
  if (values.length === 0) return null
  return (
    <div className='space-y-1 rounded-md border p-2'>
      {values.map((col, i) => (
        <div key={col} className='flex items-center gap-2 text-sm'>
          <span className='text-muted-foreground w-4 shrink-0 text-xs'>{i + 1}.</span>
          <span className='flex-1 truncate'>{col}</span>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-6'
            disabled={i === 0}
            onClick={() => onMove(i, -1)}
          >
            <ChevronUp className='size-3.5' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-6'
            disabled={i === values.length - 1}
            onClick={() => onMove(i, 1)}
          >
            <ChevronDown className='size-3.5' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-destructive size-6'
            onClick={() => onRemove(col)}
          >
            <span className='text-xs'>×</span>
          </Button>
        </div>
      ))}
    </div>
  )
}

interface WidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: number
  connectors: Connector[]
  /** presente => editar; ausente => crear */
  widget?: Widget
  /** sugerencia del copiloto de IA para pre-llenar el formulario al crear */
  aiSuggestion?: WidgetSuggestion
  /** parche del copiloto de IA para pre-llenar el formulario al editar */
  aiEditSuggestion?: WidgetEditSuggestion
  onSaved: () => void
}

export function WidgetDialog({
  open,
  onOpenChange,
  dashboardId,
  connectors,
  widget,
  aiSuggestion,
  aiEditSuggestion,
  onSaved,
}: WidgetDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!widget
  const [kind, setKind] = useState<WidgetKind>('chart')
  const [title, setTitle] = useState('')
  const [connectorId, setConnectorId] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [color, setColor] = useState<WidgetColor>('primary')
  const [xKey, setXKey] = useState('')
  const [granoKey, setGranoKey] = useState('')
  const [yKey, setYKey] = useState('')
  const [aggregation, setAggregation] = useState<Aggregation>('sum')
  const [targetValue, setTargetValue] = useState('')
  const [targetLabel, setTargetLabel] = useState('')
  const [filterColumn, setFilterColumn] = useState('')
  const [groupByColumns, setGroupByColumns] = useState<string[]>([])
  const [valueColumns, setValueColumns] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (widget) {
      const patch = aiEditSuggestion?.patch ?? {}
      setKind(widget.kind)
      setTitle(patch.title ?? widget.title)
      setConnectorId(widget.connectorId ? String(widget.connectorId) : '')
      setChartType(patch.chartType ?? widget.chartType)
      setColor(patch.color ?? widget.color)
      const loadedXKeyRaw = (patch.xKey ?? widget.xKey) ?? ''
      if (widget.kind === 'stat') {
        const [statXKey, statGranoKey] = loadedXKeyRaw.split(',')
        setXKey(statXKey || '')
        setGranoKey(statGranoKey || '')
      } else {
        setXKey(loadedXKeyRaw)
        setGranoKey('')
      }
      setYKey((patch.yKey ?? widget.yKey) ?? '')
      setAggregation(patch.aggregation ?? widget.aggregation ?? 'sum')
      setTargetValue(widget.targetValue !== null && widget.targetValue !== undefined ? String(widget.targetValue) : '')
      setTargetLabel(widget.targetLabel ?? '')
      setFilterColumn(patch.filterColumn ?? widget.filterColumn ?? '')
      const loadedXKey = (patch.xKey ?? widget.xKey) ?? ''
      const loadedYKey = (patch.yKey ?? widget.yKey) ?? ''
      setGroupByColumns(widget.kind === 'tree_grid' ? loadedXKey.split(',').filter(Boolean) : [])
      setValueColumns(widget.kind === 'tree_grid' ? loadedYKey.split(',').filter(Boolean) : [])
    } else if (aiSuggestion) {
      const suggestedKind = aiSuggestion.kind ?? 'chart'
      setKind(suggestedKind)
      setTitle(aiSuggestion.title)
      setConnectorId(String(aiSuggestion.connectorId))
      setChartType(aiSuggestion.chartType ?? 'bar')
      setColor(aiSuggestion.color ?? 'primary')
      setXKey(aiSuggestion.xKey ?? '')
      setGranoKey('')
      setYKey(aiSuggestion.yKey ?? '')
      setAggregation(aiSuggestion.aggregation ?? 'sum')
      setTargetValue('')
      setTargetLabel('')
      setFilterColumn(aiSuggestion.filterColumn ?? aiSuggestion.xKey ?? '')
      setGroupByColumns(
        suggestedKind === 'tree_grid' && aiSuggestion.xKey
          ? aiSuggestion.xKey.split(',').filter(Boolean)
          : []
      )
      setValueColumns(
        suggestedKind === 'tree_grid' && aiSuggestion.yKey
          ? aiSuggestion.yKey.split(',').filter(Boolean)
          : []
      )
    } else {
      setKind('chart')
      setTitle('')
      setConnectorId(connectors[0] ? String(connectors[0].id) : '')
      setChartType('bar')
      setColor('primary')
      setXKey('')
      setGranoKey('')
      setYKey('')
      setAggregation('sum')
      setTargetValue('')
      setTargetLabel('')
      setFilterColumn('')
      setGroupByColumns([])
      setValueColumns([])
    }
  }, [open, widget, aiSuggestion, aiEditSuggestion, connectors])

  // Contador para forzar un re-render tras crear el SemanticModel por
  // primera vez (ver el useEffect de abajo): useModelVersion(model) no
  // sirve para esa transicion null -> modelo, solo re-emite una vez ya
  // suscrito a un modelo existente.
  const [modelTick, setModelTick] = useState(0)

  // Detecta las columnas reales del conector via "probar": ese endpoint aplica
  // un rango de fechas por defecto (las APIs parametrizadas por fecha devuelven
  // vacio sin el) y ya reune las columnas de una muestra, no solo de la 1a fila.
  // Las mismas filas de muestra sirven para inicializar el SemanticModel (si
  // aun no existe para este conector), asi las metricas calculadas quedan
  // disponibles sin pasar antes por el panel "Metrics" del dashboard.
  useEffect(() => {
    if (!open || !connectorId) {
      setColumns([])
      return
    }
    let cancelled = false
    setColumnsLoading(true)
    biApi
      .test(Number(connectorId))
      .then((result) => {
        if (cancelled) return
        setColumns(result.ok ? result.columns : [])
        if (result.ok && result.rows.length > 0) {
          getConnectorSemanticModel(Number(connectorId), result.rows)
          setModelTick((t) => t + 1)
        }
      })
      .catch(() => {
        if (!cancelled) setColumns([])
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, connectorId])

  const semanticModel = connectorId ? peekConnectorSemanticModel(Number(connectorId)) : null
  const modelVersion = useModelVersion(semanticModel) + modelTick

  // Metricas calculadas ya creadas para este conector (panel "Metrics" del
  // dashboard), si el modelo semantico ya fue construido en esta sesion: se
  // ofrecen junto a las columnas crudas para que "Tabla dinamica" pueda usar
  // metricas como "rentabilidad" sin escribir el nombre a mano.
  const calculatedMetricNames = useMemo(() => {
    if (!connectorId) return []
    return (
      peekConnectorSemanticModel(Number(connectorId))
        ?.listMeasures()
        .filter((m) => m.isCalculated)
        .map((m) => m.name) ?? []
    )
  }, [connectorId, modelVersion])
  const valueColumnOptions = useMemo(
    () => Array.from(new Set([...columns, ...calculatedMetricNames])),
    [columns, calculatedMetricNames]
  )
  // Solo las metricas calculadas escalares (sin SUM/AVG/etc., ej. "ruta" =
  // CONCAT(origen, destino)) sirven para agrupar o como columna objetivo de
  // un filtro: una medida como "rentabilidad" solo existe por grupo, no por
  // fila, y no tiene sentido agrupar o filtrar por ella.
  const scalarMetricNames = useMemo(() => {
    if (!connectorId) return []
    return listScalarCalculatedMeasureNames(Number(connectorId))
  }, [connectorId, modelVersion])
  const groupableColumnOptions = useMemo(
    () => Array.from(new Set([...columns, ...scalarMetricNames])),
    [columns, scalarMetricNames]
  )
  // "yKey" del widget KPI (stat) resuelve a una metrica calculada (no una
  // columna cruda): en ese caso el widget evalua el valor con el motor de
  // arbol (respeta simple/leaf/derived), asi que el selector de agregacion
  // manual no aplica -- ya esta definida por la formula de la metrica.
  const yKeyIsMetric = calculatedMetricNames.includes(yKey)

  const needsConnector = KINDS_REQUIRING_CONNECTOR.includes(kind)
  const allowsOptionalConnector = kind === 'calendar' || kind === 'filter_date'
  const hasColor = KINDS_WITH_COLOR.includes(kind)
  const hasXY = KINDS_WITH_XY.includes(kind)
  const hasColumnLists = KINDS_WITH_COLUMN_LISTS.includes(kind)

  const toggleGroupByColumn = (col: string) =>
    setGroupByColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  const moveGroupByColumn = (index: number, direction: -1 | 1) =>
    setGroupByColumns((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const toggleValueColumn = (col: string) =>
    setValueColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  const moveValueColumn = (index: number, direction: -1 | 1) =>
    setValueColumns((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning(t('Give the widget a title'))
      return
    }
    if (needsConnector && !connectorId) {
      toast.warning(t('This widget type requires a connector'))
      return
    }
    if (kind === 'filter_date' || kind === 'filter_select') {
      if (!filterColumn.trim()) {
        toast.warning(t('Give the filter a target column'))
        return
      }
    }
    if (kind === 'tree_grid' && valueColumns.length === 0) {
      toast.warning(t('Pick at least one value column'))
      return
    }

    // xKey: charts/combo/progress/map + calendar + tree_grid (grupos) +
    // stat (eje X de desglose + grano, codificados como "eje,grano" -- ver
    // stat-widget.tsx); yKey: charts/combo/progress/map + stat + tree_grid
    const wantsXKey = hasXY || hasColumnLists || kind === 'calendar' || kind === 'stat'
    const wantsYKey = hasXY || hasColumnLists || kind === 'stat'
    const xKeyValue = hasColumnLists
      ? groupByColumns.join(',')
      : kind === 'stat'
        ? (xKey || granoKey ? `${xKey},${granoKey}` : '')
        : xKey
    const yKeyValue = hasColumnLists ? valueColumns.join(',') : yKey
    const targetValueNum = targetValue.trim() === '' ? null : Number(targetValue)

    setSaving(true)
    try {
      if (isEdit) {
        await dashboardApi.updateWidget(dashboardId, widget.id, {
          title,
          chartType: kind === 'chart' ? chartType : undefined,
          color: hasColor ? color : undefined,
          xKey: wantsXKey ? xKeyValue || null : undefined,
          yKey: wantsYKey ? yKeyValue || null : undefined,
          aggregation: kind === 'stat' || kind === 'tree_grid' ? aggregation : undefined,
          targetValue: kind === 'stat' ? targetValueNum : undefined,
          targetLabel: kind === 'stat' ? targetLabel.trim() || null : undefined,
          filterColumn:
            kind === 'filter_date' || kind === 'filter_select'
              ? filterColumn
              : undefined,
        })
        toast.success(t('Widget updated'))
      } else {
        await dashboardApi.addWidget(dashboardId, {
          connectorId: connectorId ? Number(connectorId) : null,
          title,
          kind,
          chartType: kind === 'chart' ? chartType : undefined,
          color: hasColor ? color : undefined,
          xKey: wantsXKey ? xKeyValue || null : undefined,
          yKey: wantsYKey ? yKeyValue || null : undefined,
          aggregation: kind === 'stat' || kind === 'tree_grid' ? aggregation : undefined,
          targetValue: kind === 'stat' ? targetValueNum : undefined,
          targetLabel: kind === 'stat' ? targetLabel.trim() || null : undefined,
          filterColumn:
            kind === 'filter_date' || kind === 'filter_select'
              ? filterColumn
              : undefined,
          layout: DEFAULT_LAYOUT[kind],
        })
        toast.success(t('Widget added'))
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('Edit widget') : t('Add widget')}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {!isEdit && aiSuggestion?.explanation && (
            <div className='bg-muted/50 flex items-start gap-2 rounded-md border p-3 text-sm'>
              <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' />
              <p className='text-muted-foreground'>
                {aiSuggestion.explanation}
              </p>
            </div>
          )}
          {isEdit && aiEditSuggestion?.explanation && (
            <div className='bg-muted/50 flex items-start gap-2 rounded-md border p-3 text-sm'>
              <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' />
              <p className='text-muted-foreground'>
                {aiEditSuggestion.explanation}
              </p>
            </div>
          )}

          {!isEdit && (
            <div className='space-y-2'>
              <Label>{t('Widget type')}</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as WidgetKind)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(WIDGET_KIND_LABELS[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='widget-title'>{t('Title')}</Label>
            <Input
              id='widget-title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Sales by month')}
            />
          </div>

          {kind !== 'clock' && (
            <div className='space-y-2'>
              <Label>{t('Connector')}</Label>
              <Select
                value={connectorId || NO_CONNECTOR_VALUE}
                onValueChange={(v) =>
                  setConnectorId(v === NO_CONNECTOR_VALUE ? '' : v)
                }
                disabled={isEdit}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder={t('Choose a connector')} />
                </SelectTrigger>
                <SelectContent>
                  {allowsOptionalConnector && (
                    <SelectItem value={NO_CONNECTOR_VALUE}>
                      {t('None')}
                    </SelectItem>
                  )}
                  {connectors.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {connectorId && columns.length === 0 && !columnsLoading && (
                <p className='text-muted-foreground text-xs'>
                  {t(
                    "Could not detect this connector's columns; type the column name manually."
                  )}
                </p>
              )}
            </div>
          )}

          {hasColor && (
            <div className='space-y-2'>
              <Label>{t('Color')}</Label>
              <div className='flex flex-wrap gap-2.5 items-center pt-0.5'>
                {WIDGET_COLORS.map((c) => (
                  <button
                    key={c}
                    type='button'
                    onClick={() => setColor(c)}
                    title={t(WIDGET_COLOR_LABELS[c])}
                    className={cn(
                      'size-8 rounded-full border-2 transition-all relative flex items-center justify-center shadow-xs hover:scale-110 active:scale-95 cursor-pointer',
                      color === c
                        ? 'border-foreground ring-2 ring-foreground/30 scale-110'
                        : 'border-transparent opacity-85 hover:opacity-100'
                    )}
                    style={{ background: WIDGET_COLOR_CSS[c].solid }}
                  >
                    {color === c && (
                      <span className='size-2 rounded-full bg-white shadow-xs' />
                    )}
                    <span className='sr-only'>{t(WIDGET_COLOR_LABELS[c])}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'chart' && (
            <div className='space-y-2'>
              <Label>{t('Chart type')}</Label>
              <Select
                value={chartType}
                onValueChange={(v) => setChartType(v as ChartType)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {t(CHART_TYPE_LABELS[ct])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {((kind === 'chart' && chartType !== 'table') || kind === 'combo') && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('X axis column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Y axis column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'progress' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('Label column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Value column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'map' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('Region column (country)')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Value column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'tree_grid' && (
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label>{t('Group by columns')}</Label>
                <p className='text-muted-foreground text-xs'>
                  {t('Pick one or more columns to build the row hierarchy, in order.')}
                </p>
                {groupByColumns.length > 0 && (
                  <>
                    <p className='text-muted-foreground text-xs'>
                      {t('Order (first = outermost level). Use the arrows to reorder.')}
                    </p>
                    <OrderedColumnList
                      values={groupByColumns}
                      onMove={moveGroupByColumn}
                      onRemove={toggleGroupByColumn}
                    />
                  </>
                )}
                <ColumnMultiSelect
                  values={groupByColumns}
                  onToggle={toggleGroupByColumn}
                  columns={groupableColumnOptions}
                  columnsLoading={columnsLoading}
                  loadingText={t('Loading columns…')}
                  emptyText={t('Choose a connector to see its columns.')}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Value columns')}</Label>
                <p className='text-muted-foreground text-xs'>
                  {t('Numeric columns to total per group.')}
                </p>
                {valueColumns.length > 0 && (
                  <>
                    <p className='text-muted-foreground text-xs'>
                      {t('Order (first = leftmost column). Use the arrows to reorder.')}
                    </p>
                    <OrderedColumnList
                      values={valueColumns}
                      onMove={moveValueColumn}
                      onRemove={toggleValueColumn}
                    />
                  </>
                )}
                <ColumnMultiSelect
                  values={valueColumns}
                  onToggle={toggleValueColumn}
                  columns={valueColumnOptions}
                  columnsLoading={columnsLoading}
                  loadingText={t('Loading columns…')}
                  emptyText={t('Choose a connector to see its columns.')}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Aggregation')}</Label>
                <Select
                  value={aggregation}
                  onValueChange={(v) => setAggregation(v as Aggregation)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(AGGREGATION_LABELS[a])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='bg-muted/30 rounded-md border border-muted p-3'>
                <p className='text-xs font-medium'>{t('How filters work')}</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('Filters are configured with separate "Date Range" and "Selection" widgets on the dashboard. Once added, filters automatically apply to this table based on matching column names.')}
                </p>
              </div>
            </div>
          )}

          {kind === 'stat' && (
            <div className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='widget-ykey'>{t('Column to aggregate')}</Label>
                  <ColumnField
                    id='widget-ykey'
                    value={yKey}
                    onChange={setYKey}
                    columns={valueColumnOptions}
                    columnsLoading={columnsLoading}
                    autoLabel={t('Auto-detect')}
                    placeholder={t('e.g. total_millones')}
                  />
                </div>
                {yKeyIsMetric ? (
                  <div className='space-y-2'>
                    <Label>{t('Aggregation')}</Label>
                    <p className='text-muted-foreground rounded-md border p-2 text-xs'>
                      {t('Defined by the metric formula')}
                    </p>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <Label>{t('Aggregation')}</Label>
                    <Select
                      value={aggregation}
                      onValueChange={(v) => setAggregation(v as Aggregation)}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGGREGATIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {t(AGGREGATION_LABELS[a])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {yKeyIsMetric && (
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='widget-xkey'>
                      {t('X axis column')}{' '}
                      <span className='text-muted-foreground'>{t('(optional)')}</span>
                    </Label>
                    <ColumnField
                      id='widget-xkey'
                      value={xKey}
                      onChange={setXKey}
                      columns={groupableColumnOptions}
                      columnsLoading={columnsLoading}
                      allowAuto
                      autoLabel={t('None (single value)')}
                      placeholder={t('e.g. mes')}
                    />
                    <p className='text-muted-foreground text-xs'>
                      {t('Shows one point per value of this column (e.g. month) instead of a single total.')}
                    </p>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='widget-grano'>
                      {t('Grain column')}{' '}
                      <span className='text-muted-foreground'>
                        {t('(optional, required for leaf-level metrics)')}
                      </span>
                    </Label>
                    <ColumnField
                      id='widget-grano'
                      value={granoKey}
                      onChange={setGranoKey}
                      columns={columns}
                      columnsLoading={columnsLoading}
                      allowAuto
                      autoLabel={t('None')}
                      placeholder={t('e.g. manifiesto')}
                    />
                    <p className='text-muted-foreground text-xs'>
                      {t('Some formulas (e.g. mixing MIN/MAX with SUM) must be evaluated per unit before totaling. Pick the column that identifies that unit (e.g. an id column) if the total looks wrong.')}
                    </p>
                  </div>
                </div>
              )}
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='widget-target-value'>
                    {t('Target value')}{' '}
                    <span className='text-muted-foreground'>{t('(optional)')}</span>
                  </Label>
                  <Input
                    id='widget-target-value'
                    type='number'
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder={t('e.g. 0.15')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='widget-target-label'>
                    {t('Target label')}{' '}
                    <span className='text-muted-foreground'>{t('(optional)')}</span>
                  </Label>
                  <Input
                    id='widget-target-label'
                    value={targetLabel}
                    onChange={(e) => setTargetLabel(e.target.value)}
                    placeholder={t('e.g. Meta Terceros')}
                  />
                </div>
              </div>
              {targetValue.trim() !== '' && (
                <p className='text-muted-foreground text-xs'>
                  {t('When a target is set, the KPI card draws a goal-line chart instead of the plain number.')}
                </p>
              )}
            </div>
          )}

          {kind === 'calendar' && (
            <div className='space-y-2'>
              <Label htmlFor='widget-xkey'>
                {t('Date column to highlight')}{' '}
                <span className='text-muted-foreground'>
                  {t('(optional)')}
                </span>
              </Label>
              <ColumnField
                id='widget-xkey'
                value={xKey}
                onChange={setXKey}
                columns={columns}
                columnsLoading={columnsLoading}
                allowAuto
                autoLabel={t('None')}
                placeholder={t('e.g. created_at')}
              />
            </div>
          )}

          {(kind === 'filter_date' || kind === 'filter_select') && (
            <div className='space-y-2'>
              <Label htmlFor='widget-filter-column'>
                {t('Target column')}
              </Label>
              <ColumnField
                id='widget-filter-column'
                value={filterColumn}
                onChange={setFilterColumn}
                columns={groupableColumnOptions}
                columnsLoading={columnsLoading}
                autoLabel={t('Auto-detect')}
                placeholder={t('e.g. created_at')}
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Widgets on this dashboard that share this column will be filtered automatically.'
                )}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving…') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
