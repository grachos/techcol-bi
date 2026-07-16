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
import { useConnectorData, type Row } from '@/hooks/use-connector-data'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { formatCompactNumber, truncateLabel } from '@/lib/format-number'
import { applyFilters, type ActiveFilters } from '@/lib/widget-filters'

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
  const { rows, error } = useConnectorData(widget.connectorId)

  const filteredRows = useMemo(
    () => applyFilters(rows, activeFilters),
    [rows, activeFilters]
  )

  const { x: xKey, bars, line } = useMemo(
    () => detectSeries(filteredRows, widget.xKey, widget.yKey),
    [filteredRows, widget.xKey, widget.yKey]
  )

  const data = useMemo(
    () =>
      filteredRows.map((r) => ({
        ...r,
        [bars]: Number(r[bars]),
        ...(line ? { [line]: Number(r[line]) } : {}),
      })),
    [filteredRows, bars, line]
  )

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
  if (!bars) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No numeric columns to chart')}
      </p>
    )
  }

  const barColor = WIDGET_COLOR_CSS[widget.color].solid
  const lineColor = WIDGET_COLOR_CSS.pink.solid
  // Widget bajito: sin ejes para dejar todo el espacio a la grafica
  const compact = widget.layout.h <= 3

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
          width={36}
          tickFormatter={(v: number) => formatCompactNumber(v)}
          hide={compact}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
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
