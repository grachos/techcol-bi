import { useQuery } from '@tanstack/react-query'
import { biApi } from '@/lib/bi-api'
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
 */
export function useConnectorData(connectorId: number | null | undefined) {
  const shareToken = useShareToken()

  const query = useQuery({
    queryKey: ['connector-data', connectorId, shareToken],
    queryFn: () =>
      shareToken
        ? biApi.dashboard.dataShared(shareToken, connectorId as number)
        : biApi.data(connectorId as number),
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
    isLoading: query.isLoading,
  }
}
