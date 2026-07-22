import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
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
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    () => new Set(restoredValue?.type === 'select' ? restoredValue.values : [])
  )
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

  // Una seleccion persistida (guardada en el servidor como "ultima consulta")
  // puede quedar obsoleta: si el valor ya no aparece entre las filas actuales
  // (metrica editada, formato de fecha corregido, dato borrado en la fuente),
  // el filtro nunca volveria a coincidir con ninguna fila -- para SIEMPRE,
  // aunque se amplie el rango de fechas -- sin mostrar ningun error, porque
  // desde la perspectiva del widget simplemente "no hay filas". Se descartan
  // los valores obsoletos en cuanto se detectan, en vez de dejar un filtro
  // fantasma imposible de diagnosticar desde la UI.
  useEffect(() => {
    if (isLoading || needsDateFilter || error || options.length === 0) return
    const stale = Array.from(selectedValues).filter((v) => !options.includes(v))
    if (stale.length === 0) return
    const cleaned = new Set(selectedValues)
    stale.forEach((v) => cleaned.delete(v))
    setSelectedValues(cleaned)
    updateFilter(cleaned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  const handleToggleValue = (value: string) => {
    const newSelected = new Set(selectedValues)
    if (newSelected.has(value)) {
      newSelected.delete(value)
    } else {
      newSelected.add(value)
    }
    setSelectedValues(newSelected)
    updateFilter(newSelected)
  }

  const handleToggleAll = () => {
    if (selectedValues.size === options.length) {
      setSelectedValues(new Set())
      updateFilter(new Set())
    } else {
      const newSelected = new Set(options)
      setSelectedValues(newSelected)
      updateFilter(newSelected)
    }
  }

  const updateFilter = (values: Set<string>) => {
    if (!widget.filterColumn) return
    onChange(
      widget.filterColumn,
      values.size === 0 ? null : { type: 'select', values: Array.from(values) }
    )
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
  const displayText =
    selectedValues.size === 0
      ? t('All')
      : selectedValues.size === 1
        ? Array.from(selectedValues)[0]
        : `${selectedValues.size} ${t('selected')}`

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3'>
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
      <p className='text-muted-foreground text-xs'>
        {t('Filters column "{{column}}"', { column: widget.filterColumn })}
      </p>
    </div>
  )
}
