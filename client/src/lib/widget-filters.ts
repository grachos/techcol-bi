/**
 * Filtros de dashboard: los widgets de tipo filter_date/filter_select
 * publican un valor por nombre de columna; cualquier otro widget (chart/stat/
 * calendar) cuyos datos incluyan esa misma columna se filtra automaticamente.
 */

export type ActiveFilterValue =
  | { type: 'date_range'; from: string | null; to: string | null }
  | { type: 'select'; values: string[] }

export type ActiveFilters = Record<string, ActiveFilterValue>

/** Parametros que viajan al conector para filtrar en el origen. */
export type RuntimeParams = Record<string, string>

/** Dia calendario LOCAL de una fecha, como YYYY-MM-DD (sin desfase de zona). */
export function toLocalDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Convierte el valor de una celda a su dia calendario (YYYY-MM-DD) o null si
 * no es una fecha. Si ya viene como YYYY-MM-DD (lo tipico en APIs y BD) se usa
 * tal cual, para no reinterpretarlo en otra zona horaria.
 */
function cellToDay(value: unknown): string | null {
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : toLocalDay(d)
}

/**
 * Traduce los filtros activos a parametros para el backend. Solo los usan los
 * conectores parametrizados (los que declaran `queryParams` con plantillas
 * {{from}}/{{to}}); para el resto el filtrado sigue siendo del lado del
 * cliente via applyFilters().
 *
 * Se toma el primer rango de fechas activo: la API recibe un unico
 * fecha_inicio/fecha_fin, no un rango por columna.
 *
 * Si el usuario elige una sola fecha (solo from o solo to), se refleja en la
 * otra: la consulta cubre ese dia. Muchas APIs (p.ej. Silog) exigen ambos
 * limites y devuelven vacio -- sin error -- si falta uno, asi que un rango a
 * medias parece "no trae nada".
 */
export function filtersToParams(filters: ActiveFilters): RuntimeParams {
  const range = Object.values(filters).find(
    (f): f is Extract<ActiveFilterValue, { type: 'date_range' }> =>
      f.type === 'date_range'
  )
  if (!range) return {}

  // from/to ya vienen como YYYY-MM-DD (dia local) desde el widget de filtro
  const from = range.from ?? range.to
  const to = range.to ?? range.from
  if (!from || !to) return {}

  return { from, to }
}

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
        // Comparacion por dia calendario (cadenas YYYY-MM-DD): comparar
        // timestamps excluia filas del mismo dia por la hora/zona horaria.
        const day = cellToDay(value)
        if (!day) continue
        if (filter.from && day < filter.from) return false
        if (filter.to && day > filter.to) return false
      } else if (filter.type === 'select') {
        if (filter.values.length === 0) continue
        if (!filter.values.includes(String(value))) return false
      }
    }
    return true
  })
}
