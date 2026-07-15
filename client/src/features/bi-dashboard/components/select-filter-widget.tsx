import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { biApi } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { type ActiveFilterValue } from '@/lib/widget-filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_VALUE = '__all__'

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
  const [selected, setSelected] = useState(ALL_VALUE)
  const [error, setError] = useState<string | null>(null)

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

  const handleChange = (value: string) => {
    setSelected(value)
    if (!widget.filterColumn) return
    onChange(
      widget.filterColumn,
      value === ALL_VALUE ? null : { type: 'select', values: [value] }
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

  return (
    <div className='flex h-full flex-col items-center justify-center gap-2'>
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('All')}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className='text-muted-foreground text-xs'>
        {t('Filters column "{{column}}"', { column: widget.filterColumn })}
      </p>
    </div>
  )
}
