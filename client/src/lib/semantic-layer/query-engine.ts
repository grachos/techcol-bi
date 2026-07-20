import { applyFormat } from './formatting'
import type { SemanticModel } from './semantic-model'
import type { Measure, Row } from './types'

export type FilterOperator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte'

export interface SemanticFilter {
  /** nombre de dimension registrada, o columna cruda si no hay dimension */
  field: string
  operator: FilterOperator
  value: unknown
}

export interface SemanticQuery {
  /** nombres de medidas (base o calculadas) a calcular */
  metrics: string[]
  /** nombres de dimensiones para agrupar; vacio = un solo grupo (gran total) */
  dimensions?: string[]
  filters?: SemanticFilter[]
  /**
   * Medidas que reemplazan/complementan las del modelo solo para esta
   * consulta, sin registrarlas ni mutar el SemanticModel real. Pensado para
   * la vista previa en vivo del editor de metricas calculadas.
   */
  overrides?: Measure[]
}

export interface MetricValues {
  values: Record<string, unknown>
  formatted: Record<string, string>
}

export interface QueryResultRow extends MetricValues {
  key: string
  dimensionValues: Record<string, unknown>
  rowCount: number
}

export interface QueryResult {
  rows: QueryResultRow[]
  totals: QueryResultRow
}

function resolveFieldOnRow(model: SemanticModel, row: Row, field: string): unknown {
  const dimension = model.getDimension(field)
  return dimension ? row[dimension.field] : row[field]
}

function matchesFilter(model: SemanticModel, row: Row, filter: SemanticFilter): boolean {
  const value = resolveFieldOnRow(model, row, filter.field)
  switch (filter.operator) {
    case 'eq':
      return String(value) === String(filter.value)
    case 'neq':
      return String(value) !== String(filter.value)
    case 'in':
      return Array.isArray(filter.value) && filter.value.map(String).includes(String(value))
    case 'gt':
      return Number(value) > Number(filter.value)
    case 'lt':
      return Number(value) < Number(filter.value)
    case 'gte':
      return Number(value) >= Number(filter.value)
    case 'lte':
      return Number(value) <= Number(filter.value)
    default:
      return true
  }
}

interface RowGroup {
  key: string
  dimensionValues: Record<string, unknown>
  rows: Row[]
}

function groupRows(model: SemanticModel, rows: Row[], dimensionNames: string[]): RowGroup[] {
  if (dimensionNames.length === 0) {
    return [{ key: '__all__', dimensionValues: {}, rows }]
  }

  const dimensions = dimensionNames.map((name) => {
    const dimension = model.getDimension(name)
    if (!dimension) throw new Error(`Dimension desconocida: "${name}"`)
    return dimension
  })

  const buckets = new Map<string, RowGroup>()
  for (const row of rows) {
    const dimensionValues: Record<string, unknown> = {}
    const keyParts: string[] = []
    for (const dimension of dimensions) {
      const value = row[dimension.field]
      dimensionValues[dimension.name] = value
      keyParts.push(String(value))
    }
    const key = keyParts.join('␟')
    let group = buckets.get(key)
    if (!group) {
      group = { key, dimensionValues, rows: [] }
      buckets.set(key, group)
    }
    group.rows.push(row)
  }
  return Array.from(buckets.values())
}

/**
 * Resuelve un conjunto de medidas contra las filas de un grupo, con cache y
 * deteccion de ciclos en tiempo de ejecucion (defensa adicional a la
 * validacion estatica de SemanticModel). Las medidas calculadas pueden
 * referenciar otras medidas por nombre; se resuelven recursivamente.
 */
function evaluateMetrics(
  model: SemanticModel,
  groupRows: Row[],
  metricNames: string[],
  overrides?: Map<string, Measure>
): MetricValues {
  const engine = model.getExpressionEngine()
  const cache = new Map<string, unknown>()
  const resolving = new Set<string>()
  const getMeasure = (name: string) => overrides?.get(name) ?? model.getMeasure(name)

  const resolveIdentifier = (name: string): unknown => {
    if (cache.has(name)) return cache.get(name)
    if (resolving.has(name)) {
      throw new Error(`Referencia circular al resolver "${name}"`)
    }

    const measure = getMeasure(name)
    if (measure) {
      resolving.add(name)
      const value = engine.evaluate(measure.expression, { rows: groupRows, resolveIdentifier })
      resolving.delete(name)
      cache.set(name, value)
      return value
    }

    const dimension = model.getDimension(name)
    if (dimension) {
      const value = groupRows[0]?.[dimension.field] ?? null
      cache.set(name, value)
      return value
    }

    if (groupRows.length > 0 && name in groupRows[0]) {
      const value = groupRows[0][name]
      cache.set(name, value)
      return value
    }

    throw new Error(`Identificador desconocido: "${name}"`)
  }

  const values: Record<string, unknown> = {}
  const formatted: Record<string, string> = {}
  for (const name of metricNames) {
    const measure = getMeasure(name)
    const value = resolveIdentifier(name)
    values[name] = value
    formatted[name] = applyFormat(value, measure?.format)
  }
  return { values, formatted }
}

/**
 * Evalua una sola medida (base o calculada) contra un subconjunto arbitrario
 * de filas, sin agrupar ni filtrar. Pensado para consumidores que hacen su
 * propia jerarquia de agrupacion (ej. TreeGrid) y necesitan el valor
 * correcto por nodo -- recalculando formulas derivadas (ratios, IF, etc.)
 * en cada nodo en vez de reagregar valores ya agregados de los hijos.
 */
export function evaluateMetricForRows(model: SemanticModel, rows: Row[], metricName: string): number {
  const value = evaluateMetrics(model, rows, [metricName]).values[metricName]
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Como evaluateMetricForRows, pero sin forzar el resultado a numero: para
 * medidas escalares de texto (ej. CONCAT(origen, destino)), que no tiene
 * sentido coercionar a 0.
 */
export function evaluateMetricValueForRows(model: SemanticModel, rows: Row[], metricName: string): unknown {
  return evaluateMetrics(model, rows, [metricName]).values[metricName]
}

/**
 * Punto unico de calculo de la plataforma: agrupa, filtra y evalua medidas
 * (base y calculadas) contra el Semantic Model. Todos los widgets consumen
 * datos exclusivamente a traves de esta funcion (via useSemanticQuery).
 */
export function runSemanticQuery(model: SemanticModel, rows: Row[], query: SemanticQuery): QueryResult {
  const filters = query.filters ?? []
  const filteredRows = filters.length === 0 ? rows : rows.filter((row) => filters.every((f) => matchesFilter(model, row, f)))

  const dimensionNames = query.dimensions ?? []
  const groups = groupRows(model, filteredRows, dimensionNames)
  const overrides = query.overrides
    ? new Map(query.overrides.map((measure) => [measure.name, measure]))
    : undefined

  const resultRows: QueryResultRow[] = groups.map((group) => {
    const metrics = evaluateMetrics(model, group.rows, query.metrics, overrides)
    return {
      key: group.key,
      dimensionValues: group.dimensionValues,
      rowCount: group.rows.length,
      ...metrics,
    }
  })

  const totalsMetrics = evaluateMetrics(model, filteredRows, query.metrics, overrides)
  const totals: QueryResultRow = {
    key: '__total__',
    dimensionValues: {},
    rowCount: filteredRows.length,
    ...totalsMetrics,
  }

  return { rows: resultRows, totals }
}
