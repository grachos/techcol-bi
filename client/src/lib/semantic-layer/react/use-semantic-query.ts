import { useMemo } from 'react'
import { runSemanticQuery, type QueryResult, type SemanticQuery } from '../query-engine'
import type { Row } from '../types'
import { useSemanticModel } from './semantic-layer-context'

/**
 * Contrato unico de consumo de datos para widgets: ningun widget calcula
 * agregaciones por su cuenta, todos piden metricas/dimensiones aqui y
 * reciben valores ya resueltos (medidas base y calculadas) y formateados
 * segun la Semantic Layer.
 */
export function useSemanticQuery(rows: Row[], query: SemanticQuery): QueryResult {
  const model = useSemanticModel()
  const metricsKey = query.metrics.join(',')
  const dimensionsKey = (query.dimensions ?? []).join(',')
  const filtersKey = JSON.stringify(query.filters ?? [])

  return useMemo(
    () => runSemanticQuery(model, rows, query),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, rows, metricsKey, dimensionsKey, filtersKey]
  )
}
