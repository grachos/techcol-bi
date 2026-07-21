import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { useWidgetData } from '@/hooks/use-widget-data'
import { type Widget } from '@/lib/dashboard-api'
import { type ActiveFilters } from '@/lib/widget-filters'

interface CalendarWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

/** Widget informativo: calendario del mes, resalta fechas que aparecen en un conector (opcional) */
export function CalendarWidget({ widget, activeFilters }: CalendarWidgetProps) {
  // useWidgetData ya envia los parametros de fecha al origen cuando aplica
  // (conectores REST parametrizados) y aplica applyFilters() sobre el resultado.
  // Solo pide xKey: es la unica columna que este widget lee.
  const { filteredRows } = useWidgetData(
    { ...widget, connectorId: widget.xKey ? widget.connectorId : null },
    activeFilters,
    widget.xKey ? [widget.xKey] : undefined
  )
  const [month, setMonth] = useState<Date>(new Date())

  const highlightedDates = useMemo(() => {
    if (!widget.xKey) return []
    return filteredRows
      .map((r) => new Date(String(r[widget.xKey as string])))
      .filter((d) => !isNaN(d.getTime()))
  }, [filteredRows, widget.xKey])

  return (
    <div className='flex h-full items-center justify-center overflow-auto'>
      <Calendar
        mode='single'
        month={month}
        onMonthChange={setMonth}
        selected={undefined}
        modifiers={{ highlighted: highlightedDates }}
        modifiersClassNames={{
          highlighted: 'bg-primary/20 rounded-md font-semibold',
        }}
      />
    </div>
  )
}
