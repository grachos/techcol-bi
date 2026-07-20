import { applyFormat } from './formatting'
import { runSemanticQuery } from './query-engine'
import type { SemanticModel } from './semantic-model'
import type { KpiResult, Row } from './types'

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

/**
 * Evalua un KPI (valor, meta, tendencia, variacion) usando unicamente el
 * Query Engine. Pensado como infraestructura para el futuro KPI Card Widget
 * y el Gauge/Bullet Widget.
 */
export function evaluateKpi(model: SemanticModel, kpiName: string, rows: Row[]): KpiResult {
  const kpi = model.getKpi(kpiName)
  if (!kpi) throw new Error(`KPI desconocido: "${kpiName}"`)

  const metricNames = Array.from(
    new Set([kpi.metric, kpi.targetMetric, kpi.trendMetric].filter((n): n is string => Boolean(n)))
  )
  const { totals } = runSemanticQuery(model, rows, { metrics: metricNames })

  const measure = model.getMeasure(kpi.metric)
  const format = kpi.format ?? measure?.format

  const value = totals.values[kpi.metric]
  const target = kpi.targetMetric ? totals.values[kpi.targetMetric] : (kpi.targetValue ?? null)
  const trend = kpi.trendMetric ? totals.values[kpi.trendMetric] : null

  const numericValue = toNumberOrNull(value) ?? 0
  const varianceBase = kpi.trendMetric ? toNumberOrNull(trend) : toNumberOrNull(target)

  const variance = varianceBase !== null ? numericValue - varianceBase : null
  const variancePercent =
    variance !== null && varianceBase !== null && varianceBase !== 0
      ? (variance / Math.abs(varianceBase)) * 100
      : null

  let status: KpiResult['status'] = 'neutral'
  if (variance !== null && variance !== 0) {
    const goodDirection = kpi.goodDirection ?? 'up'
    const positive = goodDirection === 'up' ? variance > 0 : variance < 0
    status = positive ? 'good' : 'bad'
  }

  return {
    value,
    formattedValue: applyFormat(value, format),
    target,
    formattedTarget: target !== null && target !== undefined ? applyFormat(target, format) : null,
    trend,
    variance,
    variancePercent,
    status,
  }
}
