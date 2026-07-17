import { apiFetch } from './api-fetch'
/**
 * Cliente del Copiloto de IA (Groq, modelos open-source) en el backend.
 */
import type { Aggregation, ChartType, WidgetColor } from './dashboard-api'

export interface WidgetSuggestion {
  connectorId: number
  connectorName: string
  title: string
  chartType: ChartType
  color: WidgetColor | null
  xKey: string | null
  yKey: string | null
  explanation: string
}

export interface WidgetEditPatch {
  title?: string
  chartType?: ChartType
  color?: WidgetColor
  xKey?: string | null
  yKey?: string | null
  aggregation?: Aggregation
  filterColumn?: string
}

export interface WidgetEditSuggestion {
  patch: WidgetEditPatch
  explanation: string
}

export interface SqlGeneration {
  query: string
  explanation: string
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const aiApi = {
  suggestWidget: (prompt: string): Promise<WidgetSuggestion> =>
    apiFetch('/api/ai/suggest-widget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }).then((r) => handle(r)),

  editWidget: (
    dashboardId: number,
    widgetId: number,
    prompt: string
  ): Promise<WidgetEditSuggestion> =>
    apiFetch('/api/ai/edit-widget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboardId, widgetId, prompt }),
    }).then((r) => handle(r)),

  generateSql: (
    prompt: string,
    sampleColumns: string[],
    connectorType: 'mysql' | 'postgresql'
  ): Promise<SqlGeneration> =>
    apiFetch('/api/ai/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sampleColumns, connectorType }),
    }).then((r) => handle(r)),

  generateSqlWithSchema: (
    prompt: string,
    schemaDescription: string,
    connectorType: 'mysql' | 'postgresql'
  ): Promise<SqlGeneration> =>
    apiFetch('/api/ai/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        schemaDescription,
        connectorType,
      }),
    }).then((r) => handle(r)),

  fixQuery: (
    query: string,
    error: string,
    connectorType: 'mysql' | 'postgresql',
    schema?: string
  ): Promise<{ query: string; explanation: string }> =>
    apiFetch('/api/ai/fix-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        error,
        connectorType,
        schema,
      }),
    }).then((r) => handle(r)),
}
