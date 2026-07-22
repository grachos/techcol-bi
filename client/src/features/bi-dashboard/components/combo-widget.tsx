import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { useStatAggregation } from '@/hooks/use-stat-aggregation'
import { getWidgetColorCss, type Widget } from '@/lib/dashboard-api'
import { formatCompactNumber, truncateLabel } from '@/lib/format-number'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

/** Detecta el eje X (texto) y hasta dos series numericas para superponer */
function detectSeries(rows: Row[], xKey: string | null, yKey: string | null) {
  if (rows.length === 0) return { x: xKey ?? '', bars: '', line: '' }
  const columns = Object.keys(rows[0])
  const sample = rows[0]
  const numeric = columns.filter((c) => !isNaN(Number(sample[c])))
  const textual = columns.filter((c) => isNaN(Number(sample[c])))
  const bars = yKey || numeric[0] || ''
  const line = numeric.find((c) => c !== bars) || ''
  return {
    x: xKey || textual[0] || columns[0] || '',
    bars,
    line,
  }
}

interface ComboWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

export function ComboWidget({ widget, activeFilters }: ComboWidgetProps) {
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

  const barColor = getWidgetColorCss(widget.color).solid
  const lineColor = getWidgetColorCss('pink').solid
  const compact = widget.layout.h <= 3

  if (hasKeys) {
    if (aggLoading) return <WidgetLoading />
    if (aggNeedsDateFilter) return <WidgetEmpty text={t('Choose a date range and press Query.')} />
    if (aggError) return <WidgetError error={t('Error fetching data: {{error}}', { error: aggError })} />
    if (!aggData?.points || aggData.points.length === 0) return <WidgetEmpty text={t('No data yet.')} />

    const cleanXKey = breakdownKey || widget.xKey!
    const chartData = aggData.points.map((p) => ({
      [cleanXKey]: p.label,
      [widget.yKey!]: p.value,
    }))

    return (
      <ResponsiveContainer width='100%' height='100%'>
        <ComposedChart
          data={chartData}
          margin={compact ? { top: 4, right: 4, left: 4, bottom: 4 } : { top: 6, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
          <XAxis
            dataKey={cleanXKey}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => truncateLabel(v, 8)}
            interval='preserveStartEnd'
            minTickGap={12}
            hide={compact}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => formatCompactNumber(v)}
            hide={compact}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 12,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
            itemStyle={{ color: '#0f172a' }}
          />
          <Bar dataKey={widget.yKey!} fill={barColor} radius={[4, 4, 0, 0]} barSize={16} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  if (rawLoading) return <WidgetLoading />
  if (rawNeedsDateFilter) return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  if (rawError) return <WidgetError error={t('Error fetching data: {{error}}', { error: rawError })} />
  if (rows.length === 0 || filteredRows.length === 0) return <WidgetEmpty text={t('No data yet.')} />

  const { x: xKey, bars, line } = detectSeries(filteredRows, widget.xKey, widget.yKey)
  if (!bars) return <WidgetEmpty text={t('No numeric columns to chart')} />

  const data = filteredRows.map((r) => ({
    ...r,
    [bars]: Number(r[bars]),
    ...(line ? { [line]: Number(r[line]) } : {}),
  }))

  return (
    <ResponsiveContainer width='100%' height='100%'>
      <ComposedChart
        data={data}
        margin={compact ? { top: 4, right: 4, left: 4, bottom: 4 } : { top: 6, right: 8, left: -16, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis
          dataKey={xKey}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => truncateLabel(v, 8)}
          interval='preserveStartEnd'
          minTickGap={12}
          hide={compact}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatCompactNumber(v)}
          hide={compact}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            fontSize: 12,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
          itemStyle={{ color: '#0f172a' }}
        />
        {line && (
          <Area
            type='monotone'
            dataKey={line}
            stroke={barColor}
            fill={barColor}
            fillOpacity={0.12}
          />
        )}
        <Bar dataKey={bars} fill={barColor} radius={[4, 4, 0, 0]} barSize={16} />
        {line && (
          <Line
            type='monotone'
            dataKey={line}
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
