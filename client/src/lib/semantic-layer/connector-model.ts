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
/** Campos que el modelo ya conoce (dimensiones + medidas). */
function knownFieldNames(model: SemanticModel): Set<string> {
  const names = new Set<string>()
  for (const d of model.listDimensions()) names.add(d.name)
  for (const m of model.listMeasures()) names.add(m.name)
  return names
}

export function getConnectorSemanticModel(connectorId: number, rows: Row[]): SemanticModel | null {
  const cached = modelCache.get(connectorId)
  if (cached) {
    // El primero que construye el modelo puede haber traido filas PROYECTADAS
    // (un filtro de seleccion pide solo su columna), lo que dejaria el modelo
    // con un solo campo para siempre. Si llegan filas con columnas que aun no
    // conoce, se re-infiere para completarlo -- registerInferredFields es
    // aditivo, y el chequeo de claves nuevas lo hace correr solo al principio.
    if (rows.length > 0) {
      const known = knownFieldNames(cached)
      if (Object.keys(rows[0]).some((k) => !known.has(k))) {
        registerInferredFields(cached, rows)
      }
    }
    return cached
  }
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

/** Devuelve todas las medidas calculadas guardadas para un conector (desde cache o localStorage si no esta instanciado). */
export function getCalculatedMeasuresForConnector(connectorId: number): Measure[] {
  const model = peekConnectorSemanticModel(connectorId)
  if (model) {
    return model.listMeasures().filter((m) => m.isCalculated)
  }
  const repo = new LocalStorageMetricsRepository(`semantic-connector-${connectorId}-metrics`)
  return repo.load()
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
 * De `names`, las medidas que SI se pueden calcular con esta forma de fila.
 *
 * Las filas pueden venir proyectadas -- un filtro de seleccion pide solo su
 * columna --, y una medida que dependa de otra columna (ej. una que use
 * "manifiesto") lanzaria "Identificador desconocido" y tumbaria el widget
 * entero. Se prueba cada medida una vez contra una fila de muestra: si no se
 * puede evaluar con esta forma, tampoco con las demas.
 */
export function evaluableMeasureNames(
  model: SemanticModel,
  sampleRow: Row,
  names: string[]
): string[] {
  return names.filter((name) => {
    try {
      evaluateMetricValueForRows(model, [sampleRow], name)
      return true
    } catch {
      return false
    }
  })
}

/**
 * Agrega a cada fila el valor de las metricas calculadas escalares (por
 * fila) registradas para el conector, para que agrupar/filtrar por su
 * nombre funcione igual que con una columna real: row['ruta'] existe.
 * No hace nada si el conector no tiene metricas calculadas escalares.
 */
export function augmentRowsWithScalarMeasures(connectorId: number | null | undefined, rows: Row[]): Row[] {
  if (!connectorId) return rows
  // Construye el modelo si aun no existe (aqui ya tenemos filas): de lo
  // contrario, en pantallas que nunca abren el editor -- el visor de solo
  // lectura, el link compartido -- nadie lo construiria y las metricas
  // calculadas escalares (ej. mes = MONTH(fecha), anio = YEAR(fecha)) no se
  // agregarian a las filas, dejando sin opciones a los filtros que las usan.
  const model = getConnectorSemanticModel(connectorId, rows)
  if (!model) return rows
  const names = listScalarCalculatedMeasureNames(connectorId)
  if (names.length === 0) return rows

  const version = model.getVersion()
  const cached = augmentCache.get(rows)
  if (cached && cached.version === version) return cached.result

  const usable = evaluableMeasureNames(model, rows[0], names)
  if (usable.length === 0) return rows

  const result = rows.map((row) => {
    const extra: Row = {}
    for (const name of usable) {
      extra[name] = evaluateMetricValueForRows(model, [row], name)
    }
    return { ...row, ...extra }
  })
  augmentCache.set(rows, { version, result })
  return result
}
