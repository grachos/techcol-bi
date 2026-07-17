/**
 * Cliente del backend BI-TechCol (Express en /server).
 * En dev, Vite hace proxy de /api -> http://localhost:4000.
 */

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
  created_at: string
}

export interface ConnectorData {
  id: number
  name: string
  type: ConnectorType
  data: unknown
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

export const biApi = {
  list: (): Promise<Connector[]> =>
    fetch('/api/connectors').then((r) => handle<Connector[]>(r)),

  get: (id: number): Promise<Connector & { config: Record<string, unknown> }> =>
    fetch(`/api/connectors/${id}`).then((r) => handle(r)),

  create: (payload: {
    name: string
    type: ConnectorType
    config: Record<string, unknown>
  }): Promise<{ id: number; name: string; type: ConnectorType }> =>
    fetch('/api/connectors', {
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
    fetch(`/api/connectors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  remove: (id: number): Promise<{ deleted: boolean }> =>
    fetch(`/api/connectors/${id}`, { method: 'DELETE' }).then((r) =>
      handle(r)
    ),

  test: (id: number): Promise<{ ok: boolean }> =>
    fetch(`/api/connectors/${id}/test`, { method: 'POST' }).then((r) =>
      handle(r)
    ),

  data: (id: number): Promise<ConnectorData> =>
    fetch(`/api/connectors/${id}/data`).then((r) => handle(r)),

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
    fetch(`/api/connectors/${id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()),

  // Dashboard sharing
  dashboard: {
    share: (id: number): Promise<{ shareToken: string }> =>
      fetch(`/api/dashboards/${id}/share`, { method: 'POST' }).then((r) =>
        handle(r)
      ),

    revoke: (id: number): Promise<{ revoked: boolean }> =>
      fetch(`/api/dashboards/${id}/share`, { method: 'DELETE' }).then((r) =>
        handle(r)
      ),

    getShared: (token: string) =>
      fetch(`/api/dashboards/share/${token}`).then((r) => handle(r)),
  },
}

/** Marca que el backend usa para secretos ya guardados (no viajan en claro). */
export const SECRET_MASK = '__SECRET_STORED__'
