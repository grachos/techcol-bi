/**
 * Cliente del backend BI-TechCol (Express en /server).
 * En dev, Vite hace proxy de /api -> http://localhost:4000.
 */

export type ConnectorType =
  | 'rest_api'
  | 'google_sheets'
  | 'mysql'
  | 'postgresql'

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
}
