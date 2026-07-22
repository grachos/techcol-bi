/**
 * Cliente del backend BI-TechCol (Express en /server).
 * En dev, Vite hace proxy de /api -> http://localhost:4000.
 */
import { apiFetch } from './api-fetch'
import type { FormatSpec } from './semantic-layer/types'

export type ConnectorType =
  | 'rest_api'
  | 'google_sheets'
  | 'mysql'
  | 'postgresql'
  | 'csv'
  | 'excel'
  | 'excel_cloud'

export interface Connector {
  id: number
  name: string
  type: ConnectorType
  date_column: string | null
  sync_window_days: number
  sync_interval_minutes: number | null
  created_at: string
}

export interface ConnectorData {
  id: number
  name: string
  type: ConnectorType
  data: unknown
  /** true si el servidor recorto la respuesta por el tope de memoria (MAX_ROWS). */
  truncated?: boolean
}

/** Spec de agregacion server-side para un widget stat (ver aggregation-service). */
export interface StatAggQuery {
  yKey: string | null
  aggregation?: string
  breakdownKey?: string | null
  granoKey?: string | null
}

/** Valores unicos de una columna para un widget de filtro (se calculan en el servidor). */
export interface DistinctBody {
  column: string
  params?: Record<string, string>
  calculatedMeasures?: unknown[]
}

export interface DistinctResult {
  values: string[]
  truncated: boolean
}

export interface StatAggBody {
  params?: Record<string, string>
  activeFilters?: unknown
  calculatedMeasures?: unknown[]
  query: StatAggQuery
}

export interface StatAggResult {
  value: number | null
  formatted: string | null
  points: { label: string; value: number; formatted: string | null }[] | null
  rowCount: number
  totalRowCount: number
  spark: number[]
  format: FormatSpec | null
  isCalculated: boolean
}

/** Agregacion server-side para un widget tree_grid (Tabla dinamica). */
export interface TreeAggBody {
  params?: Record<string, string>
  activeFilters?: unknown
  calculatedMeasures?: unknown[]
  mode: 'tree'
  query: { groupByColumns: string[]; valueColumns: string[] }
}

export interface TreeNodeDTO {
  key: string
  depth: number
  dimensionValues: Record<string, unknown>
  metrics: Record<string, unknown>
  formatted: Record<string, string>
  rowCount: number
  isLeaf: boolean
  children: TreeNodeDTO[]
}

export interface TreeColumnMeta {
  id: string
  header: string
  type: 'number' | 'percent' | 'currency' | 'text'
  decimals?: number
  currency?: string
}

export interface TreeAggResult {
  root: TreeNodeDTO
  leaves: Record<string, unknown>[]
  groupByColumns: string[]
  valueColumns: string[]
  columnsMeta: TreeColumnMeta[]
  totalRowCount: number
}

/** Tabla candidata detectada dentro de una respuesta anidada (estilo Power BI). */
export interface TableCandidate {
  /** Ruta tipo "data.items" (vacío = la raíz ya es la tabla) */
  path: string
  rowCount: number
  columns: string[]
}

/** Resultado de "Probar": columnas y primeras filas que expone la fuente. */
export interface ConnectorTestResult {
  ok: boolean
  error?: string
  /** Forma de la respuesta cuando la fuente no devolvió una lista (dataPath mal puesto) */
  received?: string
  receivedFormat?: 'json' | 'xml' | 'text'
  /** Tablas detectadas dentro de la respuesta cuando la ruta configurada no da filas */
  tables?: TableCandidate[]
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  /** Filtros con que se hizo la prueba (rango por defecto si no se indicó) */
  params?: Record<string, string>
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error'
  last_sync_at: string | null
  last_watermark?: string | null
  row_count: number | null
  last_error?: string | null
}

export interface SyncResult {
  status: 'idle' | 'error'
  rowCount?: number
  watermark?: string | null
  error?: string
}

export interface SyncConfig {
  dateColumn: string | null
  syncWindowDays?: number
  syncIntervalMinutes?: number | null
}

export const CONNECTOR_TYPE_LABELS: Record<ConnectorType, string> = {
  rest_api: 'API REST',
  google_sheets: 'Google Sheets',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  csv: 'CSV File',
  excel: 'Excel Manual',
  excel_cloud: 'Excel en la Nube',
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** Serializa los filtros como query string ('' si no hay ninguno). */
function toQuery(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return qs ? `?${qs}` : ''
}

export const biApi = {
  list: (): Promise<Connector[]> =>
    apiFetch('/api/connectors').then((r) => handle<Connector[]>(r)),

  get: (id: number): Promise<Connector & { config: Record<string, unknown> }> =>
    apiFetch(`/api/connectors/${id}`).then((r) => handle(r)),

  create: (payload: {
    name: string
    type: ConnectorType
    config: Record<string, unknown>
  }): Promise<{ id: number; name: string; type: ConnectorType }> =>
    apiFetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  update: (
    id: number,
    payload: {
      name: string
      config: Record<string, unknown>
    }
  ): Promise<{ id: number; name: string; type: ConnectorType }> =>
    apiFetch(`/api/connectors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  remove: (id: number): Promise<{ deleted: boolean }> =>
    apiFetch(`/api/connectors/${id}`, { method: 'DELETE' }).then((r) =>
      handle(r)
    ),

  test: (id: number): Promise<ConnectorTestResult> =>
    apiFetch(`/api/connectors/${id}/test`, { method: 'POST' }).then((r) =>
      handle(r)
    ),

  data: (id: number, params: Record<string, string> = {}): Promise<ConnectorData> =>
    apiFetch(`/api/connectors/${id}/data${toQuery(params)}`).then((r) => handle(r)),

  syncStatus: (id: number): Promise<SyncStatus> =>
    apiFetch(`/api/connectors/${id}/sync`).then((r) => handle(r)),

  sync: (id: number, range?: { from?: string; to?: string }): Promise<SyncResult> =>
    apiFetch(`/api/connectors/${id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(range ?? {}),
    }).then((r) => handle(r)),

  syncConfig: (id: number, config: SyncConfig): Promise<{ ok: boolean }> =>
    apiFetch(`/api/connectors/${id}/sync-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).then((r) => handle(r)),

  aggregate: (id: number, body: StatAggBody): Promise<StatAggResult> =>
    apiFetch(`/api/connectors/${id}/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handle(r)),

  distinct: (id: number, body: DistinctBody): Promise<DistinctResult> =>
    apiFetch(`/api/connectors/${id}/distinct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handle(r)),

  aggregateTree: (id: number, body: TreeAggBody): Promise<TreeAggResult> =>
    apiFetch(`/api/connectors/${id}/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handle(r)),

  preview: (
    id: number,
    query: string
  ): Promise<{
    success: boolean
    error?: string
    columns: string[]
    rows: Record<string, unknown>[]
    rowCount: number
  }> =>
    apiFetch(`/api/connectors/${id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()),

  // Dashboard sharing
  dashboard: {
    share: (id: number): Promise<{ shareToken: string }> =>
      apiFetch(`/api/dashboards/${id}/share`, { method: 'POST' }).then((r) =>
        handle(r)
      ),

    revoke: (id: number): Promise<{ revoked: boolean }> =>
      apiFetch(`/api/dashboards/${id}/share`, { method: 'DELETE' }).then((r) =>
        handle(r)
      ),

    // Publicas: sin sesion, fetch plano (nunca deben mandar el token de auth)
    getShared: (token: string) =>
      fetch(`/api/dashboards/share/${token}`).then((r) => handle(r)),

    dataShared: (
      token: string,
      connectorId: number,
      params: Record<string, string> = {}
    ): Promise<ConnectorData> =>
      fetch(
        `/api/dashboards/share/${token}/connectors/${connectorId}/data${toQuery(params)}`
      ).then((r) => handle(r)),

    distinctShared: (
      token: string,
      connectorId: number,
      body: DistinctBody
    ): Promise<DistinctResult> =>
      fetch(
        `/api/dashboards/share/${token}/connectors/${connectorId}/distinct`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      ).then((r) => handle(r)),

    aggregateShared: (
      token: string,
      connectorId: number,
      body: StatAggBody
    ): Promise<StatAggResult> =>
      fetch(
        `/api/dashboards/share/${token}/connectors/${connectorId}/aggregate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      ).then((r) => handle(r)),

    aggregateTreeShared: (
      token: string,
      connectorId: number,
      body: TreeAggBody
    ): Promise<TreeAggResult> =>
      fetch(
        `/api/dashboards/share/${token}/connectors/${connectorId}/aggregate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      ).then((r) => handle(r)),
  },
}

/** Marca que el backend usa para secretos ya guardados (no viajan en claro). */
export const SECRET_MASK = '__SECRET_STORED__'
