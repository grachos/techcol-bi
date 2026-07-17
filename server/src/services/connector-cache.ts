import crypto from "crypto";
import { pool } from "../db";
import type { RuntimeParams } from "../connectors/BaseConnector";

const CACHE_TTL_MS = 60_000;

/**
 * Hash estable de los parametros de la consulta. Las claves se ordenan para
 * que {from,to} y {to,from} compartan entrada. Sin parametros -> ''.
 */
function hashParams(params: RuntimeParams): string {
  const keys = Object.keys(params).sort();
  if (keys.length === 0) return "";
  const canonical = keys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Cache de datos por conector + combinacion de filtros. Evita golpear la
 * fuente en cada refresh de cada widget que use el mismo conector: con TTL de
 * 60s, N widgets refrescando cada 15s pasan de N peticiones a la fuente por
 * ciclo a como mucho 1 cada 4 ciclos.
 *
 * Los conectores parametrizados cachean por separado cada combinacion de
 * filtros, para no servir el rango de fechas equivocado.
 */
export async function getCachedConnectorData(
  connectorId: number,
  params: RuntimeParams,
  fetchFn: () => Promise<unknown>
): Promise<unknown> {
  const paramsHash = hashParams(params);

  const [rows]: any = await pool.query(
    "SELECT data, fetched_at FROM connector_data WHERE connector_id = ? AND params_hash = ?",
    [connectorId, paramsHash]
  );
  const cached = rows[0];

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return typeof cached.data === "string" ? JSON.parse(cached.data) : cached.data;
  }

  const data = await fetchFn();

  // No bloquear la respuesta por el guardado del cache; si falla, el proximo
  // refresh simplemente vuelve a consultar la fuente.
  pool
    .query(
      `INSERT INTO connector_data (connector_id, params_hash, data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), fetched_at = CURRENT_TIMESTAMP`,
      [connectorId, paramsHash, JSON.stringify(data)]
    )
    .catch((err) => console.error("[connector-cache] no se pudo guardar", err));

  return data;
}
