import type { Key } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStatAggregation } from '@/hooks/use-stat-aggregation'
import { type Widget } from '@/lib/dashboard-api'
import { applyFormat } from '@/lib/semantic-layer'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

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

  // "xKey" guarda hasta dos columnas separadas por coma: la primera es el eje
  // X para desglosar en varios puntos (ej. "mes"); la segunda es el "grano" --
  // la unidad hoja que se evalua antes de combinar, para metricas de nivel
  // hoja que mezclan MIN/MAX con SUM (ver widget-dialog).
  const [breakdownKey, granoKey] = useMemo(() => {
    if (!widget.xKey) return [null, null] as const
    const [b, g] = widget.xKey.split(',')
    return [b || null, g || null] as const
  }, [widget.xKey])

  // Agregacion en el SERVIDOR: se manda la spec (metrica, desglose, filtros,
  // medidas calculadas) y se recibe solo el resultado ya calculado y
  // formateado, sin bajar filas crudas al navegador (ver aggregation-service).
  const { data, error, isLoading, needsDateFilter } = useStatAggregation(
    widget,
    activeFilters,
    {
      yKey: widget.yKey ?? null,
      aggregation: widget.aggregation ?? undefined,
      breakdownKey,
      granoKey,
    }
  )

  const value = data?.value ?? null
  const formattedValue = data?.formatted ?? null
  const points = data?.points ?? null
  const format = data?.format ?? undefined
  const isCalculatedMetric = data?.isCalculated ?? false
  const rowCount = data?.rowCount ?? 0
  const totalRowCount = data?.totalRowCount ?? 0
  const sparkData = useMemo(
    () => (data?.spark ?? []).map((v) => ({ v })),
    [data]
  )

  const mutedClass = onColor ? 'text-white/80' : 'text-muted-foreground'
  const sparkColor = onColor ? 'rgba(255,255,255,0.85)' : 'var(--primary)'
  const targetColor = 'var(--destructive)'
  // Widget bajito: numero mas pequeño y sin sparkline para que quepa todo
  const compact = widget.layout.h <= 3
  const hasTarget = widget.targetValue !== null && widget.targetValue !== undefined

  if (isLoading) return <WidgetLoading onColor={onColor} />
  if (needsDateFilter) {
    return <WidgetEmpty text={t('Choose a date range and press Query.')} onColor={onColor} />
  }
  if (error) {
    return (
      <WidgetError
        error={t('Error fetching data: {{error}}', { error })}
        onColor={onColor}
      />
    )
  }
  if (value === null) {
    return <WidgetEmpty text={t('No data yet.')} onColor={onColor} />
  }

  const displayValue =
    formattedValue ??
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

  // Con meta configurada, se dibuja una gráfica tipo "goal line" en vez del
  // numero simple: la meta se ve como linea horizontal roja, y el valor (uno
  // o varios puntos si hay desglose por eje X) muestra si esta por encima o
  // por debajo. Se muestra siempre que haya meta, incluso en widgets bajitos
  // (h<=3, el layout por defecto de "stat") -- la grafica ya es compacta.
  if (hasTarget) {
    const target = widget.targetValue as number
    const formattedTarget = applyFormat(target, format)
    const targetLabelText = `${widget.targetLabel ?? t('Target')} (${formattedTarget})`

    if (points && points.length > 0) {
      const values = points.map((p) => p.value)
      const lo = Math.min(...values, target)
      const hi = Math.max(...values, target)
      const scale = Math.max(Math.abs(hi), Math.abs(lo), 1e-9)
      const pad = Math.max((hi - lo) * 0.25, scale * 0.12)
      const domainMin = lo - pad
      const domainMax = hi + pad

      return (
        <div className='flex h-full flex-col gap-1'>
          <div className={`${mutedClass} text-xs`}>{widget.title}</div>
          <div className='min-h-0 flex-1'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={points} margin={{ top: 20, right: 12, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey='label'
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[domainMin, domainMax]}
                  tickFormatter={(v: number) => applyFormat(v, format)}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={((v: number | string) => applyFormat(Number(v), format)) as never}
                  contentStyle={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={target}
                  stroke={targetColor}
                  strokeWidth={2}
                  label={{
                    value: targetLabelText,
                    position: 'insideTopRight',
                    fill: targetColor,
                    fontSize: 11,
                  }}
                />
                <Line
                  type='monotone'
                  dataKey='value'
                  stroke={sparkColor}
                  strokeWidth={2}
                  dot={{ r: 4, fill: sparkColor, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }

    // Sin desglose por eje X: un solo punto (el total agregado) con la
    // linea de meta. El dominio se escala segun la magnitud real del valor
    // (no un margen fijo) para que no se vea desproporcionado en metricas
    // pequeñas como porcentajes (0-1) frente a montos grandes.
    const scale = Math.max(Math.abs(value), Math.abs(target), 1e-9)
    const pad = Math.max(Math.abs(value - target) * 0.5, scale * 0.2)
    const domainMin = Math.min(value, target) - pad
    const domainMax = Math.max(value, target) + pad
    const goalData = [{ v: value }]

    return (
      <div className='flex h-full flex-col gap-1'>
        <div className={`${mutedClass} text-xs`}>{widget.title}</div>
        <div className='min-h-0 flex-1'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={goalData} margin={{ top: 24, right: 12, bottom: 4, left: 4 }}>
              <YAxis
                domain={[domainMin, domainMax]}
                tickFormatter={(v: number) => applyFormat(v, format)}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ReferenceLine
                y={target}
                stroke={targetColor}
                strokeWidth={2}
                label={{
                  value: targetLabelText,
                  position: 'insideBottomRight',
                  fill: targetColor,
                  fontSize: 11,
                }}
              />
              <Line
                type='monotone'
                dataKey='v'
                stroke={sparkColor}
                strokeWidth={0}
                dot={(props: { key?: Key | null; cx?: number; cy?: number }) => {
                  const cx = props.cx ?? 0
                  const cy = props.cy ?? 0
                  return (
                    <g key={props.key}>
                      <circle cx={cx} cy={cy} r={5} fill={sparkColor} />
                      <text
                        x={cx}
                        y={Math.max(cy - 14, 12)}
                        textAnchor='middle'
                        fontSize={12}
                        fill={onColor ? '#fff' : 'currentColor'}
                      >
                        {displayValue}
                      </text>
                    </g>
                  )
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col justify-between gap-1'>
      <div>
        <div className={`${compact ? 'text-xl' : 'text-3xl'} font-bold tabular-nums`}>
          {displayValue}
        </div>
        <div className={`${mutedClass} text-xs`}>
          {isCalculatedMetric
            ? widget.yKey
            : t(AGGREGATION_LABELS[widget.aggregation ?? 'sum'])}
          {rowCount !== totalRowCount &&
            ` · ${t('{{n}} of {{total}} rows', {
              n: rowCount,
              total: totalRowCount,
            })}`}
        </div>
      </div>
      {!compact && sparkData.length > 1 && (
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
