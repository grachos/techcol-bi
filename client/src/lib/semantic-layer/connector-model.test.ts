import { describe, expect, it } from 'vitest'
import { evaluableMeasureNames } from './connector-model'
import { InMemoryMetricsRepository } from './repository'
import { SemanticModel } from './semantic-model'
import { registerInferredFields } from './infer-base-model'

/**
 * Reproduce el caso real que tumbaba los widgets de filtro: sus filas vienen
 * proyectadas a una sola columna, y una metrica calculada del usuario depende
 * de otra columna que esas filas no traen.
 */
function modelFor(rows: Record<string, unknown>[]) {
  const model = new SemanticModel({ repository: new InMemoryMetricsRepository() })
  registerInferredFields(model, rows)
  // Metrica escalar que depende de "manifiesto"
  model.registerMeasure({
    name: 'ref_manifiesto',
    label: 'Ref manifiesto',
    expression: 'CONCAT(manifiesto, "-x")',
    isCalculated: true,
  })
  // Metrica escalar que solo depende de "estado", presente en ambos casos
  model.registerMeasure({
    name: 'estado_upper',
    label: 'Estado upper',
    expression: 'UPPER(estado)',
    isCalculated: true,
  })
  return model
}

describe('evaluableMeasureNames', () => {
  it('descarta las medidas que dependen de columnas ausentes en filas proyectadas', () => {
    const proyectadas = [{ estado: 'CUMPLIDO' }]
    const model = modelFor(proyectadas)

    const usable = evaluableMeasureNames(model, proyectadas[0], [
      'ref_manifiesto',
      'estado_upper',
    ])

    // Antes esto lanzaba "Identificador desconocido: manifiesto" y el error
    // boundary mostraba "Error al mostrar este widget".
    expect(usable).toEqual(['estado_upper'])
  })

  it('conserva todas las medidas cuando la fila trae las columnas necesarias', () => {
    const completas = [{ estado: 'CUMPLIDO', manifiesto: '0101141979' }]
    const model = modelFor(completas)

    const usable = evaluableMeasureNames(model, completas[0], [
      'ref_manifiesto',
      'estado_upper',
    ])

    expect(usable).toEqual(['ref_manifiesto', 'estado_upper'])
  })
})
