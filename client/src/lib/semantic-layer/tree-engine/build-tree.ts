import { applyFormat } from '../formatting'
import type { Row } from '../types'
import { createEvaluator } from './evaluators'
import type { MeasureRegistry } from './measure-registry'
import type { AggregationNode } from './types'

function partitionBy(rows: Row[], dimension: string): Map<string, Row[]> {
  const buckets = new Map<string, Row[]>()
  for (const row of rows) {
    const key = String(row[dimension] ?? '')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }
  return buckets
}

function makeNode(rows: Row[], dimensionValues: Record<string, unknown>, depth: number, key: string): AggregationNode {
  return {
    key,
    depth,
    dimensionValues,
    isLeaf: false,
    rows,
    children: [],
    metrics: {},
    formatted: {},
    rowCount: rows.length,
  }
}

function computeMetrics(node: AggregationNode, registry: MeasureRegistry, phase: 'leaf' | 'parent') {
  const engine = registry.getExpressionEngine()
  for (const def of registry.evaluationOrder()) {
    const evaluator = createEvaluator(def)
    const value = phase === 'leaf'
      ? evaluator.evaluateAtLeaf({ node, registry, engine })
      : evaluator.combineAtParent({ node, registry, engine })
    node.metrics[def.name] = value
    node.formatted[def.name] = applyFormat(value, def.format)
  }
}

function recurse(node: AggregationNode, groupByPath: string[], level: number, registry: MeasureRegistry) {
  if (level === groupByPath.length) {
    node.isLeaf = true
    computeMetrics(node, registry, 'leaf')
    return
  }

  const dimension = groupByPath[level]
  const buckets = partitionBy(node.rows ?? [], dimension)
  for (const [value, subset] of buckets) {
    const child = makeNode(
      subset,
      { ...node.dimensionValues, [dimension]: subset[0]?.[dimension] ?? value },
      level + 1,
      `${node.key}␟${value}`
    )
    node.children.push(child)
    recurse(child, groupByPath, level + 1, registry)
  }

  // Las filas se conservan en todos los nodos (no solo en la hoja): las
  // medidas 'derived' pueden usar columnas crudas dentro de SUM/MIN/etc. en
  // cualquier nivel, igual que el comportamiento historico del motor plano.
  computeMetrics(node, registry, 'parent')
}

/**
 * Construye el arbol de agregacion jerarquica: agrupa `rows` segun
 * `groupByPath` (una dimension por nivel) y calcula cada medida del
 * `registry` en cada nodo, respetando su `kind` (simple/leaf/derived) --
 * ver evaluators.ts para el detalle de cada estrategia.
 */
export function buildAggregationTree(rows: Row[], groupByPath: string[], registry: MeasureRegistry): AggregationNode {
  const root = makeNode(rows, {}, 0, '__root__')
  if (groupByPath.length === 0) {
    root.isLeaf = true
    computeMetrics(root, registry, 'leaf')
    return root
  }
  recurse(root, groupByPath, 0, registry)
  return root
}
