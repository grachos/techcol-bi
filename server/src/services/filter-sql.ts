/**
 * Traduce ActiveFilters (los mismos filtros que el dashboard aplica del lado
 * del cliente via applyFilters(), ver widget-filters.ts) a una clausula WHERE
 * parametrizada para DuckDB. Mismo criterio: comparacion por dia calendario
 * (cadena) para rangos de fecha, IN para seleccion multiple; un filtro cuya
 * columna no existe en la tabla se ignora (igual que "el widget no tiene esa
 * columna, no aplica" del lado del cliente).
 *
 * Los nombres de columna solo se interpolan si estan en `availableColumns`
 * (viene de DESCRIBE, no de entrada de usuario) -- los VALORES siempre van
 * parametrizados. Asi es seguro contra inyeccion aunque `filters` venga del
 * body de la peticion.
 */
import type { ActiveFilters } from "../../../client/src/lib/widget-filters";

export function buildWhereClause(
  filters: ActiveFilters,
  availableColumns: Set<string>
): { sql: string; values: string[] } {
  const clauses: string[] = [];
  const values: string[] = [];

  for (const [column, filter] of Object.entries(filters ?? {})) {
    if (!availableColumns.has(column)) continue;
    const col = `CAST("${column}" AS VARCHAR)`;

    if (filter.type === "date_range") {
      if (filter.from) {
        clauses.push(`${col} >= ?`);
        values.push(filter.from);
      }
      if (filter.to) {
        clauses.push(`${col} <= ?`);
        values.push(filter.to);
      }
    } else if (filter.type === "select" && filter.values.length > 0) {
      const placeholders = filter.values.map(() => "?").join(", ");
      clauses.push(`${col} IN (${placeholders})`);
      values.push(...filter.values);
    }
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}
