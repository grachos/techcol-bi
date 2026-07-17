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
