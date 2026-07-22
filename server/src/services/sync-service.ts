/**
 * Sincronizacion: la API externa se consulta SOLO aqui (al sincronizar), no en
 * cada carga de dashboard. Trae filas de la fuente y las carga al motor
 * analitico (DuckDB, ver analytics-db.ts). Full refresh si el conector no
 * tiene `date_column`; incremental (ventana de relectura + delete/insert) si
 * lo tiene -- necesario porque filas ya sincronizadas pueden cambiar de
 * estado despues (ej. Silog: un manifiesto pasa a "CUMPLIDO" dias despues).
 */
import { pool } from "../db";
import { decryptConfig, EncryptedPayload } from "../utils/encryption";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { ConnectorType } from "../connectors/BaseConnector";
import { fullRefresh, incrementalRefresh, getMaxDate } from "./analytics-db";
import { purgeExpiredConnectorData } from "./connector-cache";

export interface ConnectorSyncRow {
  id: number;
  type: ConnectorType;
  config: string | EncryptedPayload;
  date_column: string | null;
  sync_window_days: number;
}

interface SyncStateRow {
  last_watermark: string | null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function getWatermark(connectorId: number): Promise<string | null> {
  const [rows]: any = await pool.query(
    "SELECT last_watermark FROM sync_state WHERE connector_id = ?",
    [connectorId]
  );
  const row: SyncStateRow | undefined = rows[0];
  return row?.last_watermark ?? null;
}

async function markSyncing(connectorId: number): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (connector_id, status) VALUES (?, 'syncing')
     ON DUPLICATE KEY UPDATE status = 'syncing'`,
    [connectorId]
  );
}

async function markDone(connectorId: number, watermark: string | null, rowCount: number): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (connector_id, status, last_sync_at, last_watermark, row_count, last_error)
     VALUES (?, 'idle', NOW(), ?, ?, NULL)
     ON DUPLICATE KEY UPDATE status = 'idle', last_sync_at = NOW(), last_watermark = VALUES(last_watermark),
       row_count = VALUES(row_count), last_error = NULL`,
    [connectorId, watermark, rowCount]
  );
}

async function markError(connectorId: number, message: string): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (connector_id, status, last_error) VALUES (?, 'error', ?)
     ON DUPLICATE KEY UPDATE status = 'error', last_error = VALUES(last_error)`,
    [connectorId, message]
  );
}

export interface SyncOverride {
  from?: string;
  to?: string;
}

/**
 * Ejecuta la sincronizacion de un conector. No valida ownership (eso lo hace
 * la ruta antes de llamar, con el connector ya cargado scoped a user_id) --
 * el scheduler tambien la llama directo, sin usuario en contexto.
 */
export async function runSync(
  connector: ConnectorSyncRow,
  override?: SyncOverride
): Promise<{ rowCount: number; watermark: string | null }> {
  await markSyncing(connector.id);
  try {
    const payload =
      typeof connector.config === "string" ? JSON.parse(connector.config) : connector.config;
    const config = decryptConfig(payload as EncryptedPayload);
    const instance = ConnectorFactory.create(connector.type, config);

    let params: Record<string, string> = {};
    let sinceDay: string | null = null;
    let useIncremental = false;

    if (connector.date_column) {
      const watermark = override?.from ?? (await getWatermark(connector.id));
      if (watermark) {
        sinceDay = subtractDays(watermark, connector.sync_window_days);
        params = { from: sinceDay, to: override?.to ?? todayStr() };
        useIncremental = true;
      } else if (override?.from || override?.to) {
        // Primer sync de una fuente que exige rango de fechas (ej. Silog): sin
        // watermark previo, se necesita un rango explicito en la peticion.
        const from = override.from ?? override.to!;
        const to = override.to ?? override.from!;
        params = { from, to };
        sinceDay = from;
        useIncremental = true;
      }
      // Sin watermark ni override: primer sync "a ciegas" (fetchData sin
      // parametros) -- funciona para fuentes que no exigen filtro de fecha.
    }

    const raw = await instance.fetchData(params);
    const rows = Array.isArray(raw) ? raw : [];

    const rowCount =
      useIncremental && connector.date_column && sinceDay
        ? await incrementalRefresh(connector.id, rows, connector.date_column, sinceDay)
        : await fullRefresh(connector.id, rows);

    const watermark = connector.date_column
      ? await getMaxDate(connector.id, connector.date_column)
      : null;

    await markDone(connector.id, watermark, rowCount);
    return { rowCount, watermark };
  } catch (error: any) {
    await markError(connector.id, error?.message ?? String(error));
    throw error;
  }
}

/**
 * Programador minimo: cada tick revisa que conectores tienen
 * sync_interval_minutes configurado y ya vencieron, y los sincroniza uno por
 * uno (no en paralelo, para no saturar la fuente ni la conexion a DuckDB).
 * Un conector que falla no detiene a los demas.
 */
export function startSyncScheduler(tickMs = 60_000): void {
  setInterval(async () => {
    // Aprovecha el mismo tick para liberar el cache ya vencido de
    // connector_data (una fila por combinacion de filtros, con el dataset
    // completo dentro). No es critico, por eso solo se registra si falla.
    try {
      const purged = await purgeExpiredConnectorData();
      if (purged > 0) {
        console.log(`[cache-purge] ${purged} entrada(s) vencida(s) liberada(s)`);
      }
    } catch (error) {
      console.error("[cache-purge] no se pudo limpiar connector_data:", error);
    }

    let due: any[];
    try {
      const [rows]: any = await pool.query(
        `SELECT c.id, c.type, c.config, c.date_column, c.sync_window_days
         FROM connectors c
         LEFT JOIN sync_state s ON s.connector_id = c.id
         WHERE c.sync_interval_minutes IS NOT NULL
           AND s.status != 'syncing'
           AND (s.last_sync_at IS NULL OR s.last_sync_at <= NOW() - INTERVAL c.sync_interval_minutes MINUTE)`
      );
      due = rows;
    } catch (error) {
      console.error("[sync-scheduler] error listando conectores debidos:", error);
      return;
    }

    for (const connector of due) {
      try {
        const result = await runSync(connector);
        console.log(`[sync-scheduler] conector ${connector.id}: ${result.rowCount} filas`);
      } catch (error: any) {
        console.error(`[sync-scheduler] conector ${connector.id} fallo:`, error?.message ?? error);
      }
    }
  }, tickMs);
}
