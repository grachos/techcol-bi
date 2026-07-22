import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { useStatAggregation } from '@/hooks/use-stat-aggregation'
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

  const [breakdownKey, granoKey] = useMemo(() => {
    if (!widget.xKey) return [null, null] as const
    const [b, g] = widget.xKey.split(',')
    return [b || null, g || null] as const
  }, [widget.xKey])

  const hasKeys = !!widget.xKey && !!widget.yKey

  const { data: aggData, error: aggError, isLoading: aggLoading, needsDateFilter: aggNeedsDateFilter } =
    useStatAggregation(
      widget,
      activeFilters,
      {
        yKey: widget.yKey ?? null,
        aggregation: widget.aggregation ?? undefined,
        breakdownKey,
        granoKey,
      }
    )

  const { rows, filteredRows, error: rawError, isLoading: rawLoading, needsDateFilter: rawNeedsDateFilter } =
    useWidgetData(widget, activeFilters, hasKeys ? undefined : undefined)

  if (hasKeys) {
    if (aggLoading) return <WidgetLoading />
    if (aggNeedsDateFilter) return <WidgetEmpty text={t('Choose a date range and press Query.')} />
    if (aggError) return <WidgetError error={t('Error fetching data: {{error}}', { error: aggError })} />
    if (!aggData?.points || aggData.points.length === 0) return <WidgetEmpty text={t('No data yet.')} />

    const list = aggData.points.map((p) => ({ label: p.label, value: p.value })).slice(0, MAX_ROWS)
    const max = Math.max(...list.map((it) => it.value), 1)
    const items = list.map((it) => ({ ...it, pct: Math.round((it.value / max) * 100) }))

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

  if (rawLoading) return <WidgetLoading />
  if (rawNeedsDateFilter) return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  if (rawError) return <WidgetError error={t('Error fetching data: {{error}}', { error: rawError })} />
  if (rows.length === 0 || filteredRows.length === 0) return <WidgetEmpty text={t('No data yet.')} />

  const { x: labelKey, y: valueKey } = detectKeys(filteredRows, widget.xKey, widget.yKey)
  const list = filteredRows
    .map((r) => ({
      label: String(r[labelKey] ?? ''),
      value: Number(r[valueKey]),
    }))
    .filter((it) => !isNaN(it.value))
    .slice(0, MAX_ROWS)
  const max = Math.max(...list.map((it) => it.value), 1)
  const items = list.map((it) => ({ ...it, pct: Math.round((it.value / max) * 100) }))

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
