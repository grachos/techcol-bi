import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { biApi } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { type ActiveFilterValue } from '@/lib/widget-filters'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type Row = Record<string, unknown>

function toRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is Row => typeof item === 'object' && item !== null
  )
}

interface SelectFilterWidgetProps {
  widget: Widget
  onChange: (column: string, value: ActiveFilterValue | null) => void
}

export function SelectFilterWidget({
  widget,
  onChange,
}: SelectFilterWidgetProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>([])
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    if (!widget.connectorId) return
    biApi
      .data(widget.connectorId)
      .then((result) => {
        setRows(toRows(result.data))
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      )
  }, [widget.connectorId])

  const options = useMemo(() => {
    if (!widget.filterColumn) return []
    const values = new Set<string>()
    rows.forEach((r) => {
      const v = r[widget.filterColumn as string]
      if (v !== null && v !== undefined) values.add(String(v))
    })
    return Array.from(values).sort()
  }, [rows, widget.filterColumn])

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

  if (error) {
    return (
      <p className='text-destructive text-xs'>
        {t('Error fetching data: {{error}}', { error })}
      </p>
    )
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
