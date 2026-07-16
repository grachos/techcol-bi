import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { useConnectorData } from '@/hooks/use-connector-data'
import { type Widget } from '@/lib/dashboard-api'
import { applyFilters, type ActiveFilters } from '@/lib/widget-filters'

interface CalendarWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

/** Widget informativo: calendario del mes, resalta fechas que aparecen en un conector (opcional) */
export function CalendarWidget({ widget, activeFilters }: CalendarWidgetProps) {
  const { rows } = useConnectorData(widget.connectorId && widget.xKey ? widget.connectorId : null)
  const [month, setMonth] = useState<Date>(new Date())

  const highlightedDates = useMemo(() => {
    if (!widget.xKey) return []
    const filtered = applyFilters(rows, activeFilters)
    return filtered
      .map((r) => new Date(String(r[widget.xKey as string])))
      .filter((d) => !isNaN(d.getTime()))
  }, [rows, widget.xKey, activeFilters])

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
