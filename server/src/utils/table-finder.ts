/**
 * Encuentra las "tablas" candidatas dentro de una respuesta JSON anidada: todo
 * arreglo cuyos elementos sean objetos planos. Al estilo del Navigator de
 * Power BI -- el usuario elige cual arreglo es la tabla en vez de escribir la
 * ruta ("dataPath") a mano.
 */

export interface TableCandidate {
  /** Ruta tipo "data.items" (vacia = la raiz es la tabla) */
  path: string;
  rowCount: number;
  columns: string[];
}

const MAX_DEPTH = 5;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** true si el arreglo es una tabla usable: no vacio y todos sus items son objetos. */
function isRowArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every(isPlainObject);
}

function unionColumns(rows: Record<string, unknown>[], sample = 20): string[] {
  const cols = new Set<string>();
  for (const row of rows.slice(0, sample)) {
    for (const k of Object.keys(row)) cols.add(k);
  }
  return Array.from(cols);
}

export function findTableCandidates(data: unknown): TableCandidate[] {
  const found: TableCandidate[] = [];

  function walk(value: unknown, path: string, depth: number) {
    if (depth > MAX_DEPTH) return;

    if (isRowArray(value)) {
      found.push({
        path,
        rowCount: value.length,
        columns: unionColumns(value),
      });
      // No seguir bajando dentro de las filas: buscamos la tabla, no tablas
      // anidadas dentro de cada fila (esas son columnas de tipo objeto).
      return;
    }

    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path ? `${path}.${key}` : key, depth + 1);
      }
    }
  }

  walk(data, "", 0);

  // Las tablas con mas filas primero: suele ser la que el usuario quiere.
  return found.sort((a, b) => b.rowCount - a.rowCount);
}
