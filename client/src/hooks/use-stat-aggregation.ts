import { useQuery } from '@tanstack/react-query'
import { biApi, type StatAggQuery, type StatAggResult } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { LocalStorageMetricsRepository } from '@/lib/semantic-layer'
import { filtersToParams, type ActiveFilters } from '@/lib/widget-filters'
import { useShareToken } from '@/features/bi-dashboard/share-context'

/**
 * Datos de un widget stat AGREGADOS EN EL SERVIDOR: el navegador manda la spec
 * (metrica, desglose, filtros, medidas calculadas) y recibe solo el resultado
 * (unos KB), sin bajar las filas crudas. Reemplaza el pipeline client-side de
 * useWidgetData -> buildAggregationTree para este tipo de widget.
 *
 * Las medidas calculadas del usuario viven en localStorage por conector; se
 * leen directo (sin necesidad de las filas) y viajan en la peticion para que
 * el servidor pueda resolver "rentabilidad", "mes", etc.
 */
export function useStatAggregation(
  widget: Widget,
  activeFilters: ActiveFilters,
  query: StatAggQuery
) {
  const shareToken = useShareToken()
  const connectorId = widget.connectorId

  const params =
    widget.connectorType === 'rest_api' ? filtersToParams(activeFilters) : {}

  const calculatedMeasures = connectorId
    ? new LocalStorageMetricsRepository(
        `semantic-connector-${connectorId}-metrics`
      ).load()
    : []

  const body = { params, activeFilters, calculatedMeasures, query }

  const result = useQuery<StatAggResult>({
    queryKey: ['stat-agg', connectorId, shareToken, body],
    queryFn: () =>
      shareToken
        ? biApi.dashboard.aggregateShared(shareToken, connectorId as number, body)
        : biApi.aggregate(connectorId as number, body),
    enabled: connectorId != null && query.yKey != null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const error = result.error
    ? result.error instanceof Error
      ? result.error.message
      : String(result.error)
    : null

  // Mismo criterio que useWidgetData: un conector REST que falla sin filtros
  // suele estar esperando un rango de fechas (Silog responde error si faltan).
  const needsDateFilter =
    !!error &&
    widget.connectorType === 'rest_api' &&
    Object.keys(params).length === 0

  return {
    data: result.data ?? null,
    error: needsDateFilter ? null : error,
    needsDateFilter,
    isLoading: result.isPending && connectorId != null && query.yKey != null,
  }
}
