import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectorData, type Row } from '@/hooks/use-connector-data'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { applyFilters, type ActiveFilters } from '@/lib/widget-filters'

const MAX_ROWS = 12

// Colores rotativos para las barras (estilo "Performance Listing")
const BAR_COLORS = [
  WIDGET_COLOR_CSS.pink.solid,
  WIDGET_COLOR_CSS.purple.solid,
  WIDGET_COLOR_CSS.orange.solid,
  WIDGET_COLOR_CSS.green.solid,
  WIDGET_COLOR_CSS.blue.solid,
  WIDGET_COLOR_CSS.teal.solid,
]

function detectKeys(rows: Row[], xKey: string | null, yKey: string | null) {
  if (rows.length === 0) return { x: xKey ?? '', y: yKey ?? '' }
  const columns = Object.keys(rows[0])
  const sample = rows[0]
  const numeric = columns.filter((c) => !isNaN(Number(sample[c])))
  const textual = columns.filter((c) => isNaN(Number(sample[c])))
  return {
    x: xKey || textual[0] || columns[0] || '',
    y: yKey || numeric[0] || '',
  }
}

interface ProgressWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

export function ProgressWidget({ widget, activeFilters }: ProgressWidgetProps) {
  const { t } = useTranslation()
  const { rows, error } = useConnectorData(widget.connectorId)

  const filteredRows = useMemo(
    () => applyFilters(rows, activeFilters),
    [rows, activeFilters]
  )

  const { x: labelKey, y: valueKey } = useMemo(
    () => detectKeys(filteredRows, widget.xKey, widget.yKey),
    [filteredRows, widget.xKey, widget.yKey]
  )

  const items = useMemo(() => {
    const list = filteredRows
      .map((r) => ({
        label: String(r[labelKey] ?? ''),
        value: Number(r[valueKey]),
      }))
      .filter((it) => !isNaN(it.value))
      .slice(0, MAX_ROWS)
    const max = Math.max(...list.map((it) => it.value), 1)
    return list.map((it) => ({ ...it, pct: Math.round((it.value / max) * 100) }))
  }, [filteredRows, labelKey, valueKey])

  if (error) {
    return (
      <p className='text-destructive text-xs'>
        {t('Error fetching data: {{error}}', { error })}
      </p>
    )
  }
  if (rows.length === 0) {
    return <p className='text-muted-foreground text-xs'>{t('No data yet.')}</p>
  }
  if (items.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No numeric columns to chart')}
      </p>
    )
  }

  return (
    <div className='flex h-full flex-col gap-3 overflow-y-auto pe-1'>
      {items.map((it, i) => (
        <div key={i} className='space-y-1'>
          <div className='flex items-center justify-between text-xs'>
            <span className='truncate font-medium'>{it.label}</span>
            <span className='text-muted-foreground tabular-nums'>
              {new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 2,
              }).format(it.value)}
            </span>
          </div>
          <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
            <div
              className='h-full rounded-full transition-[width]'
              style={{
                width: `${it.pct}%`,
                background: BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
