import type { ExpressionEngine } from '../expression'
import type { Row } from '../types'
import type { MeasureRegistry } from './measure-registry'
import type { AggregationNode, MeasureDef, SimpleMeasureDef, LeafMeasureDef, DerivedMeasureDef } from './types'

export interface TreeEvalContext {
  node: AggregationNode
  registry: MeasureRegistry
  engine: ExpressionEngine
}

export interface MeasureEvaluator {
  /** Calcula el valor de la medida en un nodo hoja, a partir de sus filas crudas. */
  evaluateAtLeaf(ctx: TreeEvalContext): unknown
  /** Calcula el valor de la medida en un nodo padre, a partir de sus hijos (ya resueltos). */
  combineAtParent(ctx: TreeEvalContext): unknown
}

/** Resuelve un identificador contra las medidas ya calculadas del nodo actual, o contra una columna cruda. */
function resolveSibling(node: AggregationNode, name: string): unknown {
  if (name in node.metrics) return node.metrics[name]
  return node.rows?.[0]?.[name] ?? null
}

function aggregateRaw(rows: Row[], column: string | null, aggregation: SimpleMeasureDef['aggregation']): number {
  if (aggregation === 'count') return rows.length
  if (!column) return 0
  if (aggregation === 'distinctcount') {
    const seen = new Set<string>()
    for (const row of rows) {
      const v = row[column]
      if (v !== null && v !== undefined && v !== '') seen.add(String(v))
    }
    return seen.size
  }
  const values = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n))
  if (values.length === 0) return 0
  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return 0
  }
}

function combine(values: number[], combinator: 'sum' | 'avg' | 'min' | 'max'): number {
  if (values.length === 0) return 0
  switch (combinator) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}

/**
 * SUM/COUNT/MIN/MAX son distributivas: el valor de un padre se obtiene
 * combinando los valores ya calculados de sus hijos (mismo tipo de
 * combinacion que la propia agregacion), sin volver a tocar filas crudas.
 * DISTINCTCOUNT NO es distributiva de verdad (distinct(A∪B) != distinct(A)
 * + distinct(B)): en el padre se recalcula sobre las filas de todo el
 * subarbol, que por eso se conservan mientras existan medidas distinctcount
 * en el registro (ver build-tree.ts).
 */
export class SimpleMeasureEvaluator implements MeasureEvaluator {
  constructor(private def: SimpleMeasureDef) {}

  evaluateAtLeaf({ node }: TreeEvalContext): unknown {
    return aggregateRaw(node.rows ?? [], this.def.column, this.def.aggregation)
  }

  combineAtParent({ node }: TreeEvalContext): unknown {
    if (this.def.aggregation === 'distinctcount') {
      // No es distributiva (distinct(A∪B) != distinct(A) + distinct(B)):
      // se recalcula sobre las filas crudas del nodo, que siempre estan
      // disponibles (ver build-tree.ts).
      return aggregateRaw(node.rows ?? [], this.def.column, 'distinctcount')
    }
    const childValues = node.children.map((c) => Number(c.metrics[this.def.name] ?? 0))
    const combinator = this.def.aggregation === 'count' ? 'sum' : this.def.aggregation
    return combine(childValues, combinator)
  }
}

/**
 * Formula evaluada UNA sola vez, en el grano hoja (ej. "Margen" por
 * manifiesto). Los nodos padre NUNCA vuelven a evaluar la formula: combinan
 * los valores ya calculados de sus hijos con `combinator` (default sum).
 * Esto es lo que corrige el bug de MIN(flete) recalculado sobre filas de
 * multiples manifiestos combinadas.
 */
export class LeafMeasureEvaluator implements MeasureEvaluator {
  constructor(private def: LeafMeasureDef) {}

  evaluateAtLeaf({ node, engine }: TreeEvalContext): unknown {
    return engine.evaluate(this.def.expression, {
      rows: node.rows ?? [],
      resolveIdentifier: (name) => resolveSibling(node, name),
    })
  }

  combineAtParent({ node }: TreeEvalContext): unknown {
    const childValues = node.children.map((c) => Number(c.metrics[this.def.name] ?? 0))
    return combine(childValues, this.def.combinator ?? 'sum')
  }
}

/**
 * Formula re-evaluada en cada nodo (hoja o padre). Los identificadores que
 * coinciden con otra medida ya resuelta en el nodo usan ese valor; el resto
 * (columnas crudas dentro de SUM/MIN/etc.) usa las filas del nodo, igual que
 * el comportamiento historico -- para no romper formulas existentes que
 * agregan columnas crudas directamente en vez de referenciar otra medida.
 */
export class DerivedMeasureEvaluator implements MeasureEvaluator {
  constructor(private def: DerivedMeasureDef) {}

  private evaluate({ node, engine }: TreeEvalContext): unknown {
    return engine.evaluate(this.def.expression, {
      rows: node.rows ?? [],
      resolveIdentifier: (name) => resolveSibling(node, name),
    })
  }

  evaluateAtLeaf(ctx: TreeEvalContext) {
    return this.evaluate(ctx)
  }

  combineAtParent(ctx: TreeEvalContext) {
    return this.evaluate(ctx)
  }
}

export function createEvaluator(def: MeasureDef): MeasureEvaluator {
  switch (def.kind) {
    case 'simple':
      return new SimpleMeasureEvaluator(def)
    case 'leaf':
      return new LeafMeasureEvaluator(def)
    case 'derived':
      return new DerivedMeasureEvaluator(def)
  }
}

/** Filas crudas de todo el subarbol de `node` (recorre hijos recursivamente). */
export function collectRows(node: AggregationNode): Row[] {
  if (node.isLeaf) return node.rows ?? []
  return node.children.flatMap(collectRows)
}
