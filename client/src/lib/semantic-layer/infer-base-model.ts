import type { SemanticModel } from './semantic-model'
import type { Row } from './types'

/**
 * Inferencia del modelo base (dimensiones/medidas) a partir de una muestra de
 * filas. Codigo PURO -- sin localStorage ni React -- para que corra igual en
 * el cliente (connector-model.ts) y en el servidor (aggregation-service.ts):
 * la misma inferencia en ambos lados = mismos numeros.
 */

export function humanize(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function looksNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)
}

// Campos numericos que en realidad son codigos/identificadores (no medidas
// sumables): se registran igual como dimension, no como medida SUM.
const ID_LIKE_PATTERN = /(^|_)(id|codigo|documento|nit)$/i

export function inferFields(rows: Row[], sampleSize = 50) {
  const sample = rows.slice(0, sampleSize)
  const fields = sample.length > 0 ? Object.keys(sample[0]) : []
  const dimensions: string[] = []
  const measures: string[] = []

  for (const field of fields) {
    const values = sample
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined && v !== '')
    if (values.length === 0) continue

    const numericRatio = values.filter(looksNumeric).length / values.length
    if (numericRatio >= 0.9 && !ID_LIKE_PATTERN.test(field)) {
      measures.push(field)
    } else {
      dimensions.push(field)
    }
  }
  return { dimensions, measures }
}

/**
 * Registra en el modelo las dimensiones (texto), medidas base SUM (numericas)
 * y la medida COUNT 'registros', inferidas de las filas. No registra medidas
 * calculadas por el usuario: esas se agregan aparte (localStorage en cliente,
 * o enviadas en la peticion en el servidor).
 */
export function registerInferredFields(model: SemanticModel, rows: Row[]): void {
  const { dimensions, measures } = inferFields(rows)

  for (const field of dimensions) {
    model.registerDimension({ name: field, label: humanize(field), field })
  }
  for (const field of measures) {
    model.registerMeasure({
      name: field,
      label: humanize(field),
      expression: `SUM(${field})`,
      format: { type: 'number', decimals: 0 },
    })
  }
  model.registerMeasure({
    name: 'registros',
    label: 'Registros',
    expression: 'COUNT()',
    format: { type: 'number', decimals: 0 },
  })
}
