import { useMemo } from 'react'
import { type Widget } from '@/lib/dashboard-api'
import {
  applyFilters,
  filtersToParams,
  type ActiveFilters,
} from '@/lib/widget-filters'
import { augmentRowsWithScalarMeasures } from '@/lib/semantic-layer'
import { useConnectorData, type Row } from './use-connector-data'

const EMPTY_ROWS: Row[] = []

/**
 * Datos de un widget con los filtros del dashboard ya aplicados.
 *
 * Los filtros actuan en dos niveles:
 *  - En el origen: solo para conectores REST, que son los unicos que pueden
 *    declarar `queryParams` y filtrar del lado de la API. Mandar los params a
 *    un conector MySQL/Sheets no filtraria nada y solo ensuciaria el cache.
 *  - En el cliente: applyFilters() sobre las filas recibidas, para todos.
 *    Si la API ya filtro por fecha, volver a aplicarlo aqui es inocuo.
 *
 * `columns`: opcional -- ver useConnectorData. Si se omite, sigue siendo
 * SELECT * (comportamiento identico al de antes de este parametro).
 *
 * `enabled`: opcional -- en false no se pide nada Y no se procesa nada. Lo usan
 * los widgets que tienen dos caminos (agregado por /aggregate vs. filas crudas)
 * para apagar el crudo cuando su configuracion actual usa el agregado: antes se
 * llamaba igual y se bajaba + augmentaba + filtraba el dataset entero para
 * despues no leerlo, que era el bloqueo real del hilo principal al mover un filtro.
 */
export function useWidgetData(
  widget: Widget,
  activeFilters: ActiveFilters,
  columns?: string[],
  enabled = true
) {
  const params = useMemo(
    () =>
      widget.connectorType === 'rest_api' ? filtersToParams(activeFilters) : {},
    [widget.connectorType, activeFilters]
  )

  const {
    rows: fetchedRows,
    error,
    isLoading,
  } = useConnectorData(widget.connectorId, params, columns, enabled)

  // Sin datos que procesar, los useMemo de abajo tienen que ver un array
  // ESTABLE: `[]` literal cambiaria de identidad en cada render y volveria a
  // disparar augment/applyFilters (baratos con 0 filas, pero invalidarian el
  // WeakMap de augmentRowsWithScalarMeasures en cada vuelta).
  const rawRows = enabled ? fetchedRows : EMPTY_ROWS

  // Agrega columnas virtuales para metricas calculadas escalares (ej. "ruta"
  // = CONCAT(origen, destino)), asi agrupar/filtrar por su nombre funciona
  // igual que con una columna real de la fuente.
  const rows = useMemo(
    () => augmentRowsWithScalarMeasures(widget.connectorId, rawRows),
    [widget.connectorId, rawRows]
  )

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
