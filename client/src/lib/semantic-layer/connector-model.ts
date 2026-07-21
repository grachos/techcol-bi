import { registerInferredFields } from './infer-base-model'
import { evaluateMetricValueForRows } from './query-engine'
import { LocalStorageMetricsRepository } from './repository'
import { SemanticModel } from './semantic-model'
import type { Row } from './types'

const modelCache = new Map<number, SemanticModel>()

/**
 * Modelo semantico inferido a partir de una muestra de filas de un conector:
 * columnas de texto -> dimensiones, columnas numericas -> medidas base (SUM),
 * mas 'registros' (COUNT). Se cachea por connectorId (un solo modelo por
 * conector, compartido por todos los widgets que lo usan); las metricas
 * calculadas que el usuario cree persisten en localStorage por conector.
 *
 * Devuelve null mientras no haya filas disponibles todavia (primera carga);
 * una vez construido, el modelo se cachea y las filas de llamadas
 * posteriores ya no afectan su esquema (solo se usan para evaluar).
 */
export function getConnectorSemanticModel(connectorId: number, rows: Row[]): SemanticModel | null {
  const cached = modelCache.get(connectorId)
  if (cached) return cached
  if (rows.length === 0) return null

  const model = new SemanticModel({
    repository: new LocalStorageMetricsRepository(`semantic-connector-${connectorId}-metrics`),
  })

  registerInferredFields(model, rows)

  modelCache.set(connectorId, model)
  return model
}

/** Modelo ya cacheado para el conector, sin construirlo (para lecturas puntuales que no deben disparar inferencia). */
export function peekConnectorSemanticModel(connectorId: number): SemanticModel | null {
  return modelCache.get(connectorId) ?? null
}

/**
 * Metricas calculadas por el usuario que NO usan agregacion (SUM/AVG/etc.):
 * se pueden evaluar fila por fila, ej. "ruta" = CONCAT(origen, destino).
 * Estas son las unicas que tiene sentido ofrecer como columna para agrupar
 * (tree_grid) o como columna objetivo de un filtro, a diferencia de una
 * medida como "rentabilidad" = SUM(x)/SUM(y) que solo existe por grupo.
 */
export function listScalarCalculatedMeasureNames(connectorId: number): string[] {
  const model = peekConnectorSemanticModel(connectorId)
  if (!model) return []
  const engine = model.getExpressionEngine()
  return model
    .listMeasures()
    .filter((m) => m.isCalculated && engine.isRowScalar(m.expression))
    .map((m) => m.name)
}

// Cache por conector del ultimo augmentado: la clave es la REFERENCIA del
// array de filas de entrada (estable entre widgets gracias al cache de
// React Query en use-connector-data.ts), asi que si 8 widgets del mismo
// dashboard usan el mismo conector, solo el primero paga el costo de
// evaluar las metricas escalares fila por fila -- los demas reciben el
// mismo resultado ya calculado. Se invalida si cambia `rows` (nuevos datos)
// o si el modelo se edito (version del SemanticModel), no por cada
// instancia de useWidgetData que lo pide.
const augmentCache = new WeakMap<Row[], { version: number; result: Row[] }>()

/**
 * Agrega a cada fila el valor de las metricas calculadas escalares (por
 * fila) registradas para el conector, para que agrupar/filtrar por su
 * nombre funcione igual que con una columna real: row['ruta'] existe.
 * No hace nada si el conector no tiene metricas calculadas escalares.
 */
export function augmentRowsWithScalarMeasures(connectorId: number | null | undefined, rows: Row[]): Row[] {
  if (!connectorId) return rows
  const model = peekConnectorSemanticModel(connectorId)
  if (!model) return rows
  const names = listScalarCalculatedMeasureNames(connectorId)
  if (names.length === 0) return rows

  const version = model.getVersion()
  const cached = augmentCache.get(rows)
  if (cached && cached.version === version) return cached.result

  const result = rows.map((row) => {
    const extra: Row = {}
    for (const name of names) {
      extra[name] = evaluateMetricValueForRows(model, [row], name)
    }
    return { ...row, ...extra }
  })
  augmentCache.set(rows, { version, result })
  return result
}
