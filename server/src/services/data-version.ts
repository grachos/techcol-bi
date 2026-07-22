/**
 * Version de los datos sincronizados por conector. Forma parte de la clave del
 * cache de agregacion: una version nueva = clave nueva, asi la invalidacion es
 * automatica, sin TTL ni borrados manuales.
 *
 * Se DERIVA de sync_state (last_sync_at + row_count), que ya persiste en
 * MariaDB, en vez de llevar un contador en memoria del proceso. Con el
 * contador local, en un despliegue con varios procesos (PM2 en cluster) el
 * proceso que no corrio el sync nunca se enteraba del cambio y seguia
 * sirviendo su cache viejo indefinidamente -- datos desactualizados sin
 * ninguna señal. Leyendo el estado compartido todos invalidan igual, y la
 * version sobrevive a un reinicio.
 */
import { pool } from "../db";

export async function getDataVersion(connectorId: number): Promise<string> {
  const [rows]: any = await pool.query(
    "SELECT last_sync_at, row_count FROM sync_state WHERE connector_id = ?",
    [connectorId]
  );
  const state = rows[0];
  if (!state) return "0";
  const syncedAt = state.last_sync_at
    ? new Date(state.last_sync_at).getTime()
    : 0;
  // row_count entra en la llave para cubrir dos syncs dentro del mismo segundo
  // que si cambiaron los datos.
  return `${syncedAt}:${state.row_count ?? 0}`;
}
