import { useMemo } from 'react'
import { type Widget } from '@/lib/dashboard-api'
import {
  applyFilters,
  filtersToParams,
  type ActiveFilters,
} from '@/lib/widget-filters'
import { useConnectorData, type Row } from './use-connector-data'

/**
 * Datos de un widget con los filtros del dashboard ya aplicados.
 *
 * Los filtros actuan en dos niveles:
 *  - En el origen: solo para conectores REST, que son los unicos que pueden
 *    declarar `queryParams` y filtrar del lado de la API. Mandar los params a
 *    un conector MySQL/Sheets no filtraria nada y solo ensuciaria el cache.
 *  - En el cliente: applyFilters() sobre las filas recibidas, para todos.
 *    Si la API ya filtro por fecha, volver a aplicarlo aqui es inocuo.
 */
export function useWidgetData(widget: Widget, activeFilters: ActiveFilters) {
  const params = useMemo(
    () =>
      widget.connectorType === 'rest_api' ? filtersToParams(activeFilters) : {},
    [widget.connectorType, activeFilters]
  )

  const { rows, error, isLoading } = useConnectorData(widget.connectorId, params)

  const filteredRows = useMemo(
    () => applyFilters(rows, activeFilters),
    [rows, activeFilters]
  )

  // Un conector REST que falla sin filtros suele estar esperando un rango de
  // fechas (muchas APIs responden error si faltan). En vez del error crudo se
  // sugiere elegir un rango; una vez aplicado, si vuelve a fallar, se muestra
  // el error real.
  const needsDateFilter =
    !!error &&
    widget.connectorType === 'rest_api' &&
    Object.keys(params).length === 0

  return {
    rows,
    filteredRows,
    error: needsDateFilter ? null : error,
    needsDateFilter,
    isLoading,
  }
}

export type { Row }
