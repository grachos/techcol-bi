import { useQuery } from '@tanstack/react-query'
import { biApi, type TreeAggResult } from '@/lib/bi-api'
import { type Widget } from '@/lib/dashboard-api'
import { LocalStorageMetricsRepository } from '@/lib/semantic-layer'
import { filtersToParams, type ActiveFilters } from '@/lib/widget-filters'
import { useShareToken } from '@/features/bi-dashboard/share-context'

/**
 * Datos de un widget tree_grid AGREGADOS EN EL SERVIDOR: el navegador manda las
 * columnas de grupo/valor y recibe el arbol ya calculado + las filas hoja
 * proyectadas (solo las columnas necesarias). Elimina del cliente la parte que
 * congelaba la pagina: buildAggregationTree sobre decenas de miles de filas.
 */
export function useTreeAggregation(
  widget: Widget,
  activeFilters: ActiveFilters,
  groupByColumns: string[],
  valueColumns: string[]
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

  const body = {
    params,
    activeFilters,
    calculatedMeasures,
    mode: 'tree' as const,
    query: { groupByColumns, valueColumns },
  }

  const enabled = connectorId != null && valueColumns.length > 0

  const result = useQuery<TreeAggResult>({
    queryKey: ['tree-agg', connectorId, shareToken, body],
    queryFn: () =>
      shareToken
        ? biApi.dashboard.aggregateTreeShared(shareToken, connectorId as number, body)
        : biApi.aggregateTree(connectorId as number, body),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const error = result.error
    ? result.error instanceof Error
      ? result.error.message
      : String(result.error)
    : null

  const needsDateFilter =
    !!error &&
    widget.connectorType === 'rest_api' &&
    Object.keys(params).length === 0

  return {
    data: result.data ?? null,
    error: needsDateFilter ? null : error,
    needsDateFilter,
    isLoading: result.isPending && enabled,
  }
}
