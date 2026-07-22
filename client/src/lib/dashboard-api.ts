/**
 * Cliente del backend de Dashboards (Express en /server).
 */
import { apiFetch } from './api-fetch'
import type { ConnectorType } from './bi-api'
import type { ActiveFilters } from './widget-filters'

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'table'

export const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'table']

export type WidgetKind =
  | 'chart'
  | 'stat'
  | 'calendar'
  | 'clock'
  | 'filter_date'
  | 'filter_select'
  | 'progress'
  | 'map'
  | 'combo'
  | 'tree_grid'

export const WIDGET_KINDS: WidgetKind[] = [
  'chart',
  'stat',
  'combo',
  'progress',
  'map',
  'tree_grid',
  'calendar',
  'clock',
  'filter_date',
  'filter_select',
]

/** Kinds que requieren un conector para funcionar (deben mostrarse en el selector) */
export const KINDS_REQUIRING_CONNECTOR: WidgetKind[] = [
  'chart',
  'stat',
  'filter_select',
  'progress',
  'map',
  'combo',
  'tree_grid',
]

export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max'

export const AGGREGATIONS: Aggregation[] = ['sum', 'avg', 'count', 'min', 'max']

export type WidgetColor =
  | 'primary'
  | 'pink'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'teal'

export const WIDGET_COLORS: WidgetColor[] = [
  'primary',
  'pink',
  'blue',
  'green',
  'orange',
  'purple',
  'teal',
]

/**
 * Paleta de colores por widget. Cada color trae el valor CSS para el fondo/relleno
 * y un tono suave para superficies. Se usan valores oklch fijos para no depender
 * del tema (las tarjetas de color van con texto blanco encima).
 */
export const WIDGET_COLOR_CSS: Record<
  WidgetColor,
  { solid: string; soft: string }
> = {
  primary: { solid: 'var(--primary)', soft: 'var(--primary)' },
  pink: { solid: 'oklch(0.62 0.22 3)', soft: 'oklch(0.62 0.22 3 / 0.15)' },
  blue: { solid: 'oklch(0.62 0.19 250)', soft: 'oklch(0.62 0.19 250 / 0.15)' },
  green: { solid: 'oklch(0.65 0.17 155)', soft: 'oklch(0.65 0.17 155 / 0.15)' },
  orange: { solid: 'oklch(0.7 0.18 55)', soft: 'oklch(0.7 0.18 55 / 0.15)' },
  purple: { solid: 'oklch(0.55 0.24 300)', soft: 'oklch(0.55 0.24 300 / 0.15)' },
  teal: { solid: 'oklch(0.6 0.12 195)', soft: 'oklch(0.6 0.12 195 / 0.15)' },
}

export function getWidgetColorCss(color?: string): { solid: string; soft: string } {
  if (!color) return WIDGET_COLOR_CSS.primary
  if (color in WIDGET_COLOR_CSS) {
    return WIDGET_COLOR_CSS[color as WidgetColor]
  }
  if (color.startsWith('#')) {
    return { solid: color, soft: `${color}26` }
  }
  return { solid: color, soft: color }
}

export function isLightColor(color?: string): boolean {
  if (!color || color === 'primary') return false
  if (color in WIDGET_COLOR_CSS) return false

  let hex = color.trim()
  if (!hex.startsWith('#')) return false

  let clean = hex.replace('#', '')
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('')
  }
  if (clean.length !== 6) return false

  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55
}

export interface DashboardSummary {
  id: number
  name: string
  isFavorite: boolean
  tags: string[]
  created_at: string
  lastQueriedAt: string | null
}

export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface Widget {
  id: number
  connectorId: number | null
  connectorName: string | null
  connectorType: ConnectorType | null
  kind: WidgetKind
  title: string
  chartType: ChartType
  color: WidgetColor
  xKey: string | null
  yKey: string | null
  aggregation: Aggregation | null
  targetValue: number | null
  targetLabel: string | null
  filterColumn: string | null
  layout: WidgetLayout
}

export interface DashboardDetail extends DashboardSummary {
  widgets: Widget[]
  lastFilters: ActiveFilters
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface WidgetPayload {
  connectorId?: number | null
  title: string
  kind: WidgetKind
  chartType?: ChartType
  color?: WidgetColor
  xKey?: string | null
  yKey?: string | null
  aggregation?: Aggregation | null
  targetValue?: number | null
  targetLabel?: string | null
  filterColumn?: string | null
  layout: WidgetLayout
}

export const dashboardApi = {
  list: (): Promise<DashboardSummary[]> =>
    apiFetch('/api/dashboards').then((r) => handle(r)),

  get: (id: number): Promise<DashboardDetail> =>
    apiFetch(`/api/dashboards/${id}`).then((r) => handle(r)),

  create: (name: string, tags?: string[]): Promise<{ id: number; name: string }> =>
    apiFetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tags }),
    }).then((r) => handle(r)),

  update: (
    id: number,
    payload: Partial<{ name: string; isFavorite: boolean; tags: string[] }>
  ): Promise<{ id: number }> =>
    apiFetch(`/api/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  remove: (id: number): Promise<{ deleted: boolean }> =>
    apiFetch(`/api/dashboards/${id}`, { method: 'DELETE' }).then((r) =>
      handle(r)
    ),

  saveLastQuery: (id: number, filters: ActiveFilters): Promise<{ saved: boolean }> =>
    apiFetch(`/api/dashboards/${id}/last-query`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    }).then((r) => handle(r)),

  addWidget: (
    dashboardId: number,
    payload: WidgetPayload
  ): Promise<{ id: number }> =>
    apiFetch(`/api/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  updateWidget: (
    dashboardId: number,
    widgetId: number,
    payload: Partial<{
      title: string
      chartType: ChartType
      color: WidgetColor
      xKey: string | null
      yKey: string | null
      aggregation: Aggregation | null
      targetValue: number | null
      targetLabel: string | null
      filterColumn: string | null
      layout: WidgetLayout
    }>
  ): Promise<{ updated: boolean }> =>
    apiFetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handle(r)),

  updateLayout: (
    dashboardId: number,
    items: (WidgetLayout & { id: number })[]
  ): Promise<{ updated: number }> =>
    apiFetch(`/api/dashboards/${dashboardId}/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }).then((r) => handle(r)),

  removeWidget: (
    dashboardId: number,
    widgetId: number
  ): Promise<{ deleted: boolean }> =>
    apiFetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'DELETE',
    }).then((r) => handle(r)),
}
