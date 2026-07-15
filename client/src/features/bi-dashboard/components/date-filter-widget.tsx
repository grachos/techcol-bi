import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type DateRange } from 'react-day-picker'
import { CalendarIcon, X } from 'lucide-react'
import { type Widget } from '@/lib/dashboard-api'
import { type ActiveFilterValue } from '@/lib/widget-filters'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateFilterWidgetProps {
  widget: Widget
  onChange: (column: string, value: ActiveFilterValue | null) => void
}

export function DateFilterWidget({ widget, onChange }: DateFilterWidgetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US'
  const [range, setRange] = useState<DateRange | undefined>()

  const column = widget.filterColumn

  const handleSelect = (value: DateRange | undefined) => {
    setRange(value)
    if (!column) return
    if (!value?.from && !value?.to) {
      onChange(column, null)
      return
    }
    onChange(column, {
      type: 'date_range',
      from: value?.from ? value.from.toISOString() : null,
      to: value?.to ? value.to.toISOString() : null,
    })
  }

  const handleClear = () => {
    setRange(undefined)
    if (column) onChange(column, null)
  }

  if (!column) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('This filter has no target column configured.')}
      </p>
    )
  }

  const label =
    range?.from && range?.to
      ? `${range.from.toLocaleDateString(locale)} – ${range.to.toLocaleDateString(locale)}`
      : range?.from
        ? range.from.toLocaleDateString(locale)
        : t('Select a date range')

  return (
    <div className='flex h-full flex-col items-center justify-center gap-2'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' className='w-full justify-start'>
            <CalendarIcon className='me-2 size-4' />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='range'
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
      {range?.from && (
        <Button variant='ghost' size='sm' onClick={handleClear}>
          <X className='me-1 size-3.5' /> {t('Clear filter')}
        </Button>
      )}
      <p className='text-muted-foreground text-xs'>
        {t('Filters column "{{column}}"', { column })}
      </p>
    </div>
  )
}
