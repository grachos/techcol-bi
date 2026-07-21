import { useQuery } from '@tanstack/react-query'
import { biApi, type SyncStatus } from '@/lib/bi-api'

/**
 * Estado de sincronizacion de un conector (ver GET /:id/sync). Se refresca
 * solo cada 30s -- no hace falta mas: el sync mismo puede tardar segundos a
 * minutos, y esto es solo para mostrar "actualizado hace X" / el spinner
 * mientras esta en curso, no un contador en tiempo real.
 */
export function useSyncStatus(connectorId: number | null | undefined) {
  return useQuery<SyncStatus>({
    queryKey: ['sync-status', connectorId],
    queryFn: () => biApi.syncStatus(connectorId as number),
    enabled: connectorId != null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
