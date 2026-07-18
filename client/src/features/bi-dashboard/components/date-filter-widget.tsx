import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type DateRange } from 'react-day-picker'
import { CalendarIcon, Search, X } from 'lucide-react'
import { type Widget } from '@/lib/dashboard-api'
import { toLocalDay, type ActiveFilterValue } from '@/lib/widget-filters'
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

/**
 * Filtro de rango de fechas. El rango se elige localmente y solo se publica
 * al pulsar "Consultar": aplicarlo en cada clic del calendario disparaba una
 * consulta con el rango a medias (solo `from`), y en conectores que filtran
 * en el origen eso significa una llamada de mas a la API externa.
 */
export function DateFilterWidget({ widget, onChange }: DateFilterWidgetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US'
  const [range, setRange] = useState<DateRange | undefined>()
  const [applied, setApplied] = useState<DateRange | undefined>()

  const column = widget.filterColumn

  const handleApply = () => {
    if (!column) return
    if (!range?.from && !range?.to) {
      onChange(column, null)
      setApplied(undefined)
      return
    }
    // Se guarda el dia calendario local (YYYY-MM-DD), no un timestamp: el
    // usuario elige un dia, no un instante. Usar toISOString() lo desplazaba a
    // UTC y descartaba filas del mismo dia por diferencia de zona horaria.
    onChange(column, {
      type: 'date_range',
      from: range?.from ? toLocalDay(range.from) : null,
      to: range?.to ? toLocalDay(range.to) : null,
    })
    setApplied(range)
  }

  const handleClear = () => {
    setRange(undefined)
    setApplied(undefined)
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

  // Hay cambios sin aplicar: el boton Consultar es la accion pendiente
  const isDirty =
    range?.from?.getTime() !== applied?.from?.getTime() ||
    range?.to?.getTime() !== applied?.to?.getTime()

  return (
    <div className='flex h-full flex-col items-center justify-center gap-2'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' className='w-full justify-start'>
            <CalendarIcon className='me-2 size-4' />
            <span className='truncate'>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='range'
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>

      <div className='flex w-full gap-1'>
        <Button
          size='sm'
          className='flex-1'
          onClick={handleApply}
          disabled={!isDirty}
        >
          <Search className='me-1 size-3.5' />
          {t('Query')}
        </Button>
        {(applied?.from || range?.from) && (
          <Button variant='ghost' size='sm' onClick={handleClear}>
            <X className='size-3.5' />
            <span className='sr-only'>{t('Clear filter')}</span>
          </Button>
        )}
      </div>

      <p className='text-muted-foreground truncate text-xs'>
        {t('Filters column "{{column}}"', { column })}
      </p>
    </div>
  )
}
