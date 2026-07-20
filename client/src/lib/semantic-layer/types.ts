export type Row = Record<string, unknown>

export type FormatType = 'number' | 'currency' | 'percent' | 'date' | 'text'

export interface FormatSpec {
  type: FormatType
  decimals?: number
  currency?: string
  prefix?: string
  suffix?: string
}

export interface Dimension {
  name: string
  label: string
  /** columna real en las filas crudas del conector */
  field: string
  description?: string
}

export interface Measure {
  name: string
  label: string
  /** expresion evaluada por el Expression Engine, ej. "SUM(revenue)" o "(revenue - cost) / revenue" */
  expression: string
  format?: FormatSpec
  description?: string
  /** true = medida creada por el usuario (Calculated Metrics Widget); false/undefined = medida base del modelo */
  isCalculated?: boolean
  /**
   * Como se evalua esta medida en un arbol jerarquico (Tabla dinamica):
   *  - 'derived' (default si no se especifica): se re-evalua en cada nodo
   *    (hoja o padre) con sus propias filas -- es el comportamiento historico,
   *    para no romper metricas ya creadas. Correcto para formulas que ya son
   *    aditivas (SUM/COUNT sobre columnas) y para ratios que referencian
   *    otras medidas por nombre (ej. "margen / remesa_total").
   *  - 'leaf': se calcula UNA vez en el nivel hoja de la jerarquia y los
   *    nodos padre suman/combinan el resultado ya calculado, sin volver a
   *    tocar filas crudas -- necesario para formulas que mezclan columnas de
   *    distinto grano (ej. "SUM(remesa) - MIN(flete)" cuando el flete se
   *    repite por manifiesto: sumar el flete de nuevo en el padre da un
   *    numero incorrecto). Actívalo manualmente si tu metrica de fila
   *    completa se ve bien pero se rompe al agrupar.
   * Medidas base auto-inferidas (SUM/COUNT sobre una columna) ignoran este
   * campo: siempre se tratan como distributivas ('simple' en el motor de
   * arbol), sin importar lo que traiga aqui.
   */
  treeKind?: 'leaf' | 'derived'
  /** Solo aplica si treeKind = 'leaf': como combinar los valores ya calculados de los hijos. Default 'sum'. */
  combinator?: 'sum' | 'avg' | 'min' | 'max'
}

export interface Kpi {
  name: string
  label: string
  /** nombre de una Measure existente */
  metric: string
  /** nombre de una Measure que representa la meta (alternativa a targetValue) */
  targetMetric?: string
  /** meta fija (alternativa a targetMetric) */
  targetValue?: number
  /** nombre de una Measure que representa el periodo anterior, para variacion */
  trendMetric?: string
  format?: FormatSpec
  /** si valores mayores son mejores (true) o peores (false); afecta el indicador visual */
  goodDirection?: 'up' | 'down'
}

export interface Relationship {
  name: string
  fromDimension: string
  toDimension: string
  description?: string
}

export type FieldKind = 'dimension' | 'measure'

export interface FieldCatalogEntry {
  name: string
  label: string
  kind: FieldKind
  description?: string
  isCalculated?: boolean
}

export interface KpiResult {
  value: unknown
  formattedValue: string
  target: unknown
  formattedTarget: string | null
  trend: unknown
  variance: number | null
  variancePercent: number | null
  status: 'good' | 'bad' | 'neutral'
}
