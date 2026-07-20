import { useEffect, useRef } from 'react'
import { dashboardApi } from '@/lib/dashboard-api'
import type { ActiveFilters } from '@/lib/widget-filters'

/**
 * Guarda en el servidor los filtros activos del dashboard (debounced), para
 * que cualquier punto de entrada (link compartido, /dashboard, /bi) muestre
 * siempre la ultima consulta realizada, sin depender del navegador.
 */
export function useDashboardPersistence(
  dashboardId: number | null,
  activeFilters: ActiveFilters
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDashboardId = useRef<number | null>(null)

  useEffect(() => {
    if (!dashboardId) return
    // Al cambiar de dashboard, activeFilters todavia trae el valor del
    // dashboard anterior por un render: no lo guardes como si fuera el
    // ultimo filtro del dashboard nuevo.
    if (lastDashboardId.current !== dashboardId) {
      lastDashboardId.current = dashboardId
      return
    }

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dashboardApi.saveLastQuery(dashboardId, activeFilters).catch(() => {
        // Silent fail: no bloquear la UI por un fallo de persistencia
      })
    }, 600)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dashboardId, activeFilters])
}
