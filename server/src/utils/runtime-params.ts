import type { RuntimeParams } from "../connectors/BaseConnector";

/** Parametros de filtro aceptados desde el query string de la peticion. */
const ALLOWED = ["from", "to"] as const;

const MAX_LEN = 64;

/**
 * Extrae los filtros de `req.query` para pasarlos al conector. Solo se aceptan
 * claves conocidas y valores string acotados: el query string es entrada del
 * usuario y termina viajando a una API externa.
 */
export function parseRuntimeParams(query: unknown): RuntimeParams {
  const source = (query ?? {}) as Record<string, unknown>;
  const params: RuntimeParams = {};

  for (const key of ALLOWED) {
    const value = source[key];
    if (typeof value === "string" && value !== "" && value.length <= MAX_LEN) {
      params[key] = value;
    }
  }
  return params;
}

const MAX_COLUMNS = 20;

/**
 * Lista de columnas pedidas por el widget en `?columns=a,b,c` (proyeccion en
 * /:id/data). undefined si no se mando -- la ruta cae a SELECT * como antes.
 * Los nombres se validan mas adelante contra el esquema real antes de
 * interpolarlos en SQL (ver getRawRowsForConnector); esto solo acota tamaño.
 */
export function parseColumnsParam(query: unknown): string[] | undefined {
  const raw = (query as Record<string, unknown> | null)?.columns;
  if (typeof raw !== "string" || raw === "") return undefined;
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "" && c.length <= MAX_LEN)
    .slice(0, MAX_COLUMNS);
}
