import { useQuery } from '@tanstack/react-query'
import { biApi } from '@/lib/bi-api'
import { type RuntimeParams } from '@/lib/widget-filters'
import { useShareToken } from '@/features/bi-dashboard/share-context'

const REFRESH_MS = 15000

export type Row = Record<string, unknown>

function toRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is Row => typeof item === 'object' && item !== null
  )
}

/**
 * Datos crudos de un conector, compartidos vía react-query entre todos los
 * widgets que apunten al mismo connectorId (una sola petición de red, sin
 * importar cuántos widgets la consuman) y sin parpadeo en cada refresh
 * (react-query conserva `data` mientras refetchea en segundo plano).
 *
 * `params` son los filtros que viajan al origen (conectores parametrizados).
 * Van en la queryKey: cambiar el rango de fechas trae datos nuevos en vez de
 * reusar los del rango anterior.
 */
export function useConnectorData(
  connectorId: number | null | undefined,
  params: RuntimeParams = {}
) {
  const shareToken = useShareToken()

  const query = useQuery({
    queryKey: ['connector-data', connectorId, shareToken, params],
    queryFn: () =>
      shareToken
        ? biApi.dashboard.dataShared(shareToken, connectorId as number, params)
        : biApi.data(connectorId as number, params),
    enabled: connectorId != null,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  })

  return {
    rows: query.data ? toRows(query.data.data) : [],
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : String(query.error)
      : null,
    // Solo la carga inicial: en los refrescos de fondo se conservan los datos
    // previos, asi que mostrar "cargando" haria parpadear el widget.
    isLoading: query.isPending && connectorId != null,
  }
}
