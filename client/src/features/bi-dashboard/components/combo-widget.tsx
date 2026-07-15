import { useEffect, useMemo, useState } from 'react'
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
import { biApi } from '@/lib/bi-api'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { applyFilters, type ActiveFilters } from '@/lib/widget-filters'

const REFRESH_MS = 15000

type Row = Record<string, unknown>

function toRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is Row => typeof item === 'object' && item !== null
  )
}

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
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!widget.connectorId) return
    let cancelled = false
    const fetchData = () => {
      biApi
        .data(widget.connectorId!)
        .then((result) => {
          if (cancelled) return
          setRows(toRows(result.data))
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : String(err))
        })
    }
    fetchData()
    const interval = setInterval(fetchData, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [widget.connectorId])

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

  return (
    <ResponsiveContainer width='100%' height='100%'>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis dataKey={xKey} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
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
