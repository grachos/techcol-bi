import type { FormatSpec, Row } from '../types'

export type MeasureKind = 'simple' | 'leaf' | 'derived'

interface BaseMeasureDef {
  name: string
  label: string
  format?: FormatSpec
  description?: string
}

/**
 * Agregacion pura sobre una columna cruda (SUM/COUNT/MIN/MAX/DISTINCTCOUNT).
 * Distributiva: el valor de un nodo padre se obtiene combinando los valores
 * ya calculados de sus hijos, sin volver a tocar las filas (excepto
 * distinctcount, que no es distributiva de verdad -- ver SimpleMeasureEvaluator).
 */
export interface SimpleMeasureDef extends BaseMeasureDef {
  kind: 'simple'
  /** columna cruda a agregar; null solo valido con aggregation: 'count' */
  column: string | null
  aggregation: 'sum' | 'count' | 'min' | 'max' | 'distinctcount'
}

/**
 * Formula que solo tiene sentido en el grano hoja del arbol (ej. "Margen" a
 * nivel de un manifiesto individual). Se evalua UNA vez por hoja; los nodos
 * padre agregan los valores YA calculados de sus hijos usando `combinator`,
 * nunca recalculan la formula sobre filas crudas combinadas.
 */
export interface LeafMeasureDef extends BaseMeasureDef {
  kind: 'leaf'
  /** formula evaluada una sola vez por hoja, ej. "SUM(remesa) - MIN(flete)" */
  expression: string
  /** como combinar los valores ya calculados de los hijos en el padre */
  combinator?: 'sum' | 'avg' | 'min' | 'max'
}

/**
 * Formula que se re-evalua en CADA nodo (hoja o padre), referenciando otras
 * medidas (simple/leaf/derived) por nombre -- usando su valor YA resuelto en
 * ese mismo nodo, nunca filas crudas directamente. Es el caso de
 * ratios/porcentajes (ej. "Rentabilidad" = Margen / Remesa).
 */
export interface DerivedMeasureDef extends BaseMeasureDef {
  kind: 'derived'
  expression: string
}

export type MeasureDef = SimpleMeasureDef | LeafMeasureDef | DerivedMeasureDef

export interface AggregationNode {
  key: string
  depth: number
  dimensionValues: Record<string, unknown>
  isLeaf: boolean
  /** filas crudas; null en nodos padre una vez calculadas sus metricas (se libera memoria) */
  rows: Row[] | null
  children: AggregationNode[]
  metrics: Record<string, unknown>
  formatted: Record<string, string>
  rowCount: number
}
