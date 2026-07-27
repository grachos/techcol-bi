import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search, X } from 'lucide-react'
import { useDistinctValues } from '@/hooks/use-distinct-values'
import { monthIndexEs } from '@/lib/semantic-layer/expression'
import { type Widget } from '@/lib/dashboard-api'
import { type ActiveFilterValue, type ActiveFilters } from '@/lib/widget-filters'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

interface SelectFilterWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
  onChange: (column: string, value: ActiveFilterValue | null) => void
}

function sameValues(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export function SelectFilterWidget({
  widget,
  activeFilters,
  onChange,
}: SelectFilterWidgetProps) {
  const { t } = useTranslation()
  // Los valores unicos los calcula el SERVIDOR (SQL para columnas reales,
  // evaluacion proyectada para calculadas como mes/anio): antes se bajaban las
  // filas crudas para sacarlos en el navegador, lo que en una columna calculada
  // significaba traerse el dataset entero.
  const { values, error, isLoading, needsDateFilter } = useDistinctValues(
    widget,
    activeFilters
  )
  const restoredValue = widget.filterColumn ? activeFilters[widget.filterColumn] : undefined
  const restored = () =>
    new Set(restoredValue?.type === 'select' ? restoredValue.values : [])

  // Igual que el filtro de fecha: la seleccion se ACUMULA en local y solo se
  // publica al pulsar "Consultar". Marcando casilla por casilla se disparaba
  // un cambio de activeFilters por clic, y cada uno invalidaba la queryKey de
  // TODOS los widgets del dashboard: marcar 5 valores = 5 rondas completas de
  // peticiones y de repintado. Ahora es una sola, cuando el usuario termina.
  const [selectedValues, setSelectedValues] = useState<Set<string>>(restored)
  const [appliedValues, setAppliedValues] = useState<Set<string>>(restored)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Si los valores son nombres de mes se ordenan cronologicamente; alfabetico
  // pondria "Abril" antes que "Enero", igual que pasaba en el eje del grafico.
  const options = useMemo(() => {
    const sorted = [...values]
    const allMonths =
      sorted.length > 0 && sorted.every((v) => monthIndexEs(v) !== -1)
    return allMonths
      ? sorted.sort((a, b) => monthIndexEs(a) - monthIndexEs(b))
      : sorted.sort()
  }, [values])

  const publish = (values: Set<string>) => {
    if (!widget.filterColumn) return
    onChange(
      widget.filterColumn,
      values.size === 0 ? null : { type: 'select', values: Array.from(values) }
    )
  }

  // Una seleccion persistida (guardada en el servidor como "ultima consulta")
  // puede quedar obsoleta: si el valor ya no aparece entre las filas actuales
  // (metrica editada, formato de fecha corregido, dato borrado en la fuente),
  // el filtro nunca volveria a coincidir con ninguna fila -- para SIEMPRE,
  // aunque se amplie el rango de fechas -- sin mostrar ningun error, porque
  // desde la perspectiva del widget simplemente "no hay filas". Se descartan
  // los valores obsoletos en cuanto se detectan, en vez de dejar un filtro
  // fantasma imposible de diagnosticar desde la UI. Esta limpieza SI publica
  // sola: corrige un filtro ya aplicado, no es una eleccion pendiente.
  useEffect(() => {
    if (isLoading || needsDateFilter || error || options.length === 0) return
    const valid = new Set(options)
    const cleanedApplied = new Set(
      Array.from(appliedValues).filter((v) => valid.has(v))
    )
    if (cleanedApplied.size === appliedValues.size) return
    setSelectedValues(
      new Set(Array.from(selectedValues).filter((v) => valid.has(v)))
    )
    setAppliedValues(cleanedApplied)
    publish(cleanedApplied)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  const handleToggleValue = (value: string) => {
    const next = new Set(selectedValues)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSelectedValues(next)
  }

  const handleToggleAll = () => {
    setSelectedValues(
      selectedValues.size === options.length ? new Set() : new Set(options)
    )
  }

  const handleApply = () => {
    setAppliedValues(new Set(selectedValues))
    publish(selectedValues)
    setPopoverOpen(false)
  }

  const handleClear = () => {
    setSelectedValues(new Set())
    setAppliedValues(new Set())
    publish(new Set())
  }

  if (!widget.filterColumn || !widget.connectorId) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('This filter has no target column configured.')}
      </p>
    )
  }

  if (isLoading) return <WidgetLoading />
  if (needsDateFilter) {
    return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  }
  if (error) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error })} />
  }

  const isAllSelected = selectedValues.size === options.length
  const isDirty = !sameValues(selectedValues, appliedValues)
  const displayText =
    selectedValues.size === 0
      ? t('All')
      : selectedValues.size === 1
        ? Array.from(selectedValues)[0]
        : `${selectedValues.size} ${t('selected')}`

  return (
    <div className='flex h-full flex-col items-center justify-center gap-2'>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            className='w-full justify-between'
          >
            <span className='truncate'>{displayText}</span>
            <ChevronDown className='size-4 opacity-50 shrink-0' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-56 p-3' align='start'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2 pb-2 border-b'>
              <Checkbox
                id='select-all'
                checked={isAllSelected}
                onCheckedChange={handleToggleAll}
              />
              <label
                htmlFor='select-all'
                className='text-sm font-medium cursor-pointer flex-1'
              >
                {t('All')}
              </label>
            </div>
            <div className='max-h-48 space-y-1 overflow-y-auto'>
              {options.map((opt) => (
                <div key={opt} className='flex items-center gap-2'>
                  <Checkbox
                    id={`opt-${opt}`}
                    checked={selectedValues.has(opt)}
                    onCheckedChange={() => handleToggleValue(opt)}
                  />
                  <label
                    htmlFor={`opt-${opt}`}
                    className='text-sm cursor-pointer flex-1 truncate'
                  >
                    {opt}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* h-6/text-xs y no el `sm` del boton (h-8/text-sm): dentro de la tarjeta
          todo lo demas -- titulo, ayuda, opciones -- es text-xs, asi que el
          tamaño por defecto se veia fuera de escala. */}
      <div className='flex w-full gap-1'>
        <Button
          size='sm'
          className='h-6 flex-1 px-2 text-xs'
          onClick={handleApply}
          disabled={!isDirty}
        >
          <Search className='me-1 size-3' />
          {t('Query')}
        </Button>
        {(appliedValues.size > 0 || selectedValues.size > 0) && (
          <Button
            variant='ghost'
            size='sm'
            className='h-6 px-1.5'
            onClick={handleClear}
          >
            <X className='size-3' />
            <span className='sr-only'>{t('Clear filter')}</span>
          </Button>
        )}
      </div>

      <p className='text-muted-foreground text-xs truncate'>
        {t('Filters column "{{column}}"', { column: widget.filterColumn })}
      </p>
    </div>
  )
}
