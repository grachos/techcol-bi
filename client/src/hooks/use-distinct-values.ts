import { useQuery } from '@tanstack/react-query'
import { biApi, type DistinctResult } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { LocalStorageMetricsRepository } from '@/lib/semantic-layer'
import { filtersToParams, type ActiveFilters } from '@/lib/widget-filters'
import { useShareToken } from '@/features/bi-dashboard/share-context'

/**
 * Valores unicos de una columna, calculados EN EL SERVIDOR.
 *
 * Antes el widget de filtro pedia las filas crudas y sacaba los distintos en
 * el navegador. Para una columna calculada (mes, anio) el servidor no puede
 * proyectar en SQL y acababa enviando el dataset completo: 146 MB y ~11 s en
 * Silog para listar 12 meses. Ahora llegan solo los valores (bytes).
 *
 * Las medidas calculadas del usuario viven en localStorage por conector y
 * viajan en la peticion, igual que en useStatAggregation, para que el servidor
 * pueda resolver "mes" o "anio".
 */
export function useDistinctValues(widget: Widget, activeFilters: ActiveFilters) {
  const shareToken = useShareToken()
  const connectorId = widget.connectorId
  const column = widget.filterColumn

  const params =
    widget.connectorType === 'rest_api' ? filtersToParams(activeFilters) : {}

  const calculatedMeasures = connectorId
    ? new LocalStorageMetricsRepository(
        `semantic-connector-${connectorId}-metrics`
      ).load()
    : []

  const body = { column: column ?? '', params, calculatedMeasures }

  const result = useQuery<DistinctResult>({
    queryKey: ['distinct', connectorId, shareToken, body],
    queryFn: () =>
      shareToken
        ? biApi.dashboard.distinctShared(shareToken, connectorId as number, body)
        : biApi.distinct(connectorId as number, body),
    enabled: connectorId != null && !!column,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const error = result.error
    ? result.error instanceof Error
      ? result.error.message
      : String(result.error)
    : null

  // Mismo criterio que el resto: un conector REST que falla sin filtros suele
  // estar esperando un rango de fechas.
  const needsDateFilter =
    !!error &&
    widget.connectorType === 'rest_api' &&
    Object.keys(params).length === 0

  return {
    values: result.data?.values ?? [],
    error: needsDateFilter ? null : error,
    needsDateFilter,
    isLoading: result.isPending && connectorId != null && !!column,
  }
}
