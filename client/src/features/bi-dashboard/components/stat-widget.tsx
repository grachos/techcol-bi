import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { biApi } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { applyFilters, type ActiveFilters } from '@/lib/widget-filters'

const REFRESH_MS = 15000

type Row = Record<string, unknown>

function toRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is Row => typeof item === 'object' && item !== null
  )
}

function aggregate(
  rows: Row[],
  key: string,
  aggregation: Widget['aggregation']
): number {
  if (aggregation === 'count') return rows.length
  const values = rows.map((r) => Number(r[key])).filter((n) => !isNaN(n))
  if (values.length === 0) return 0
  switch (aggregation) {
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'sum':
    default:
      return values.reduce((a, b) => a + b, 0)
  }
}

const AGGREGATION_LABELS: Record<NonNullable<Widget['aggregation']>, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Minimum',
  max: 'Maximum',
}

interface StatWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
  /** true cuando el widget se muestra sobre un fondo de color (texto blanco) */
  onColor: boolean
}

export function StatWidget({ widget, activeFilters, onColor }: StatWidgetProps) {
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

  const value = useMemo(() => {
    if (!widget.yKey && widget.aggregation !== 'count') return null
    return aggregate(filteredRows, widget.yKey ?? '', widget.aggregation)
  }, [filteredRows, widget.yKey, widget.aggregation])

  // Serie cruda para el sparkline (valores numericos de la columna, en orden)
  const sparkData = useMemo(() => {
    if (!widget.yKey) return []
    return filteredRows
      .map((r) => Number(r[widget.yKey as string]))
      .filter((n) => !isNaN(n))
      .map((v) => ({ v }))
  }, [filteredRows, widget.yKey])

  const mutedClass = onColor ? 'text-white/80' : 'text-muted-foreground'
  const sparkColor = onColor ? 'rgba(255,255,255,0.85)' : 'var(--primary)'

  if (error) {
    return (
      <p className={onColor ? 'text-white/90 text-xs' : 'text-destructive text-xs'}>
        {t('Error fetching data: {{error}}', { error })}
      </p>
    )
  }

  if (value === null) {
    return <p className={`${mutedClass} text-xs`}>{t('No data yet.')}</p>
  }

  return (
    <div className='flex h-full flex-col justify-between gap-1'>
      <div>
        <div className='text-3xl font-bold tabular-nums'>
          {new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2,
          }).format(value)}
        </div>
        <div className={`${mutedClass} text-xs`}>
          {t(AGGREGATION_LABELS[widget.aggregation ?? 'sum'])}
          {filteredRows.length !== rows.length &&
            ` · ${t('{{n}} of {{total}} rows', {
              n: filteredRows.length,
              total: rows.length,
            })}`}
        </div>
      </div>
      {sparkData.length > 1 && (
        <div className='h-10 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={sparkData}>
              <Area
                type='monotone'
                dataKey='v'
                stroke={sparkColor}
                strokeWidth={2}
                fill={sparkColor}
                fillOpacity={onColor ? 0.25 : 0.15}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
