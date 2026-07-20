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
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { type Widget } from '@/lib/dashboard-api'
import {
  applyFormat,
  buildAggregationTree,
  buildRegistryFromModel,
  getConnectorSemanticModel,
  useModelVersion,
} from '@/lib/semantic-layer'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

function aggregateRaw(
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

interface BreakdownPoint {
  label: string
  value: number
  formatted: string | null
}

export function StatWidget({ widget, activeFilters, onColor }: StatWidgetProps) {
  const { t } = useTranslation()
  const { rows, filteredRows, error, isLoading, needsDateFilter } =
    useWidgetData(widget, activeFilters)

  const semanticModel = widget.connectorId
    ? getConnectorSemanticModel(widget.connectorId, rows)
    : null
  const modelVersion = useModelVersion(semanticModel)

  // Registro del motor de arbol: si "yKey" es una metrica calculada por el
  // usuario de tipo 'leaf' o 'derived' (ej. "Rentabilidad" = Margen/Remesa),
  // se evalua con buildAggregationTree en vez de tratarla como columna cruda
  // -- asi respeta su "kind" y no reintroduce el bug de grano mezclado (ver
  // tree-engine/evaluators.ts). Las medidas 'simple' (SUM/COUNT auto-
  // inferidas) son distributivas: el aggregate() de abajo ya les da el mismo
  // resultado, asi que se dejan con el flujo viejo para no perder la
  // etiqueta de agregacion (ej. "Conteo").
  const registry = useMemo(
    () => (semanticModel ? buildRegistryFromModel(semanticModel) : null),
    [semanticModel, modelVersion]
  )
  const measureDef = widget.yKey ? registry?.get(widget.yKey) : undefined
  const isCalculatedMetric = measureDef?.kind === 'leaf' || measureDef?.kind === 'derived'

  // "xKey" guarda hasta dos columnas separadas por coma: la primera es el
  // eje X para desglosar en varios puntos (ej. "mes"); la segunda es el
  // "grano" -- la unidad que se evalua antes de combinar, necesaria para
  // metricas de nivel hoja que mezclan MIN/MAX con SUM (ver widget-dialog).
  const [breakdownKey, granoKey] = useMemo(() => {
    if (!widget.xKey) return [null, null] as const
    const [b, g] = widget.xKey.split(',')
    return [b || null, g || null] as const
  }, [widget.xKey])

  const metricResult = useMemo(() => {
    if (!isCalculatedMetric || !registry || !widget.yKey) return null
    const yKey = widget.yKey
    const groupByPath = [breakdownKey, granoKey].filter((c): c is string => !!c)
    const tree = buildAggregationTree(filteredRows, groupByPath, registry)

    if (breakdownKey) {
      const points: BreakdownPoint[] = tree.children
        .map((child) => ({
          label: String(child.dimensionValues[breakdownKey] ?? ''),
          value: Number(child.metrics[yKey] ?? 0),
          formatted: child.formatted[yKey] ?? null,
        }))
        .sort((a, b) => {
          const av = Number(a.label)
          const bv = Number(b.label)
          if (!Number.isNaN(av) && !Number.isNaN(bv)) return av - bv
          return a.label.localeCompare(b.label)
        })
      const last = points[points.length - 1]
      return { points, value: last?.value ?? 0, formatted: last?.formatted ?? null }
    }

    return {
      points: null as BreakdownPoint[] | null,
      value: Number(tree.metrics[yKey] ?? 0),
      formatted: tree.formatted[yKey] ?? null,
    }
  }, [isCalculatedMetric, registry, widget.yKey, breakdownKey, granoKey, filteredRows])

  const rawValue = useMemo(() => {
    if (isCalculatedMetric) return null
    if (!widget.yKey && widget.aggregation !== 'count') return null
    return aggregateRaw(filteredRows, widget.yKey ?? '', widget.aggregation)
  }, [isCalculatedMetric, filteredRows, widget.yKey, widget.aggregation])

  const value = isCalculatedMetric ? metricResult?.value ?? null : rawValue
  const formattedValue = isCalculatedMetric ? metricResult?.formatted : null
  const points = isCalculatedMetric ? metricResult?.points ?? null : null

  // Serie cruda para el sparkline (valores numericos de la columna, en
  // orden): solo tiene sentido para columnas crudas, no para metricas
  // agregadas (que no existen fila por fila).
  const sparkData = useMemo(() => {
    if (isCalculatedMetric || !widget.yKey) return []
    return filteredRows
      .map((r) => Number(r[widget.yKey as string]))
      .filter((n) => !isNaN(n))
      .map((v) => ({ v }))
  }, [isCalculatedMetric, filteredRows, widget.yKey])

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

  const format = isCalculatedMetric ? measureDef?.format : undefined
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
          {filteredRows.length !== rows.length &&
            ` · ${t('{{n}} of {{total}} rows', {
              n: filteredRows.length,
              total: rows.length,
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
