import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

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
  const { rows, filteredRows, error, isLoading } = useWidgetData(
    widget,
    activeFilters
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

  if (isLoading) return <WidgetLoading />
  if (error) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error })} />
  }
  if (rows.length === 0) return <WidgetEmpty text={t('No data yet.')} />
  if (items.length === 0) {
    return <WidgetEmpty text={t('No numeric columns to chart')} />
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
