import { pool } from "../db";

const CACHE_TTL_MS = 60_000;

/**
 * Cache de datos por conector (1 fila por connector_id en `connector_data`).
 * Evita golpear la fuente en cada refresh de cada widget que use el mismo
 * conector: con TTL de 60s, N widgets refrescando cada 15s pasan de N
 * peticiones a la fuente por ciclo a como mucho 1 cada 4 ciclos.
 */
export async function getCachedConnectorData(
  connectorId: number,
  fetchFn: () => Promise<unknown>
): Promise<unknown> {
  const [rows]: any = await pool.query(
    "SELECT data, fetched_at FROM connector_data WHERE connector_id = ?",
    [connectorId]
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
      `INSERT INTO connector_data (connector_id, data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), fetched_at = CURRENT_TIMESTAMP`,
      [connectorId, JSON.stringify(data)]
    )
    .catch((err) => console.error("[connector-cache] no se pudo guardar", err));

  return data;
}
