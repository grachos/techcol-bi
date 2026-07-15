/**
 * Filtros de dashboard: los widgets de tipo filter_date/filter_select
 * publican un valor por nombre de columna; cualquier otro widget (chart/stat/
 * calendar) cuyos datos incluyan esa misma columna se filtra automaticamente.
 */

export type ActiveFilterValue =
  | { type: 'date_range'; from: string | null; to: string | null }
  | { type: 'select'; values: string[] }

export type ActiveFilters = Record<string, ActiveFilterValue>

export function applyFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: ActiveFilters
): T[] {
  const activeKeys = Object.keys(filters)
  if (activeKeys.length === 0) return rows

  return rows.filter((row) => {
    for (const key of activeKeys) {
      if (!(key in row)) continue // el widget no tiene esta columna: no aplica
      const filter = filters[key]
      const value = row[key]

      if (filter.type === 'date_range') {
        if (!filter.from && !filter.to) continue
        const d = new Date(String(value))
        if (isNaN(d.getTime())) continue
        if (filter.from && d < new Date(filter.from)) return false
        if (filter.to && d > new Date(filter.to)) return false
      } else if (filter.type === 'select') {
        if (filter.values.length === 0) continue
        if (!filter.values.includes(String(value))) return false
      }
    }
    return true
  })
}
