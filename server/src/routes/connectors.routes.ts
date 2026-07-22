import { Router, Request, Response } from "express";
import { serverError } from "../utils/http-error";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";
import { canReadConnector } from "../services/access";
import { encryptConfig, decryptConfig, EncryptedPayload } from "../utils/encryption";
import { maskSecrets, unmaskSecrets, truncateRows } from "../utils/security";
import { parseRuntimeParams, parseColumnsParam } from "../utils/runtime-params";
import { buildResponsePreview } from "../utils/response-preview";
import { findTableCandidates } from "../utils/table-finder";
import { invalidateConnectorCache } from "../services/connector-cache";
import { runAggregateCached } from "../services/cached-aggregate";
import { getDistinctValues } from "../services/distinct-values";
import { runSync } from "../services/sync-service";
import { getRawRowsForConnector } from "../services/rows-source";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { CONNECTOR_TYPES, ConnectorType } from "../connectors/BaseConnector";

const router = Router();

interface ConnectorRow {
  id: number;
  user_id: number;
  name: string;
  type: ConnectorType;
  config: string | EncryptedPayload;
  date_column?: string | null;
  created_at: string;
}

function parseStoredConfig(raw: string | EncryptedPayload): EncryptedPayload {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Listar conectores (sin credenciales)
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, type, date_column, sync_window_days, sync_interval_minutes, created_at
       FROM connectors WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Obtener un conector específico con su configuración desencriptada
router.get("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT id, name, type, config FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const config = decryptConfig(parseStoredConfig(connector.config));
    res.json({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      // Los secretos salen enmascarados: nunca viajan en claro al navegador
      config: maskSecrets(connector.type, config as Record<string, unknown>),
    });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Crear conector: cifra las credenciales antes de guardar
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { name, type, config } = req.body ?? {};

  if (!name || !type || !config) {
    return res
      .status(400)
      .json({ error: "Campos requeridos: name, type, config" });
  }
  if (!CONNECTOR_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Tipo invalido. Soportados: ${CONNECTOR_TYPES.join(", ")}`,
    });
  }

  try {
    // Validar que la config es utilizable antes de guardar
    ConnectorFactory.create(type, config);

    const encrypted = encryptConfig(config);
    const [result]: any = await pool.query(
      "INSERT INTO connectors (user_id, name, type, config) VALUES (?, ?, ?, ?)",
      [req.userId, name, type, JSON.stringify(encrypted)]
    );
    res.status(201).json({ id: result.insertId, name, type });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

const SAMPLE_ROWS = 10;
const TEST_RANGE_DAYS = 7;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Rango por defecto para la prueba. Las fuentes parametrizadas por fecha
 * suelen exigir los filtros (responden 400 sin ellos), asi que probar sin
 * fechas fallaria siempre. Los conectores que no declaran {{from}}/{{to}} lo
 * ignoran, asi que mandarlo siempre es inocuo.
 */
function defaultTestParams(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - TEST_RANGE_DAYS * 86_400_000);
  return { from: isoDate(from), to: isoDate(to) };
}

/**
 * Probar la conexion y devolver una muestra: columnas + primeras filas.
 * Sin esto el usuario no sabe que columnas expone la fuente y tiene que
 * adivinarlas al configurar los widgets.
 *
 * Va siempre a la fuente (no usa el cache): es una prueba de que la conexion
 * funciona AHORA, y suele ejecutarse justo despues de corregir la config.
 */
router.post("/:id/test", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const config = decryptConfig(parseStoredConfig(connector.config));
    const instance = ConnectorFactory.create(connector.type, config);

    const requested = parseRuntimeParams(req.query);
    const params = { ...defaultTestParams(), ...requested };
    const data = await instance.fetchData(params);

    if (!Array.isArray(data)) {
      // La fuente respondio, pero no con una lista de filas: casi siempre es
      // un dataPath vacio o mal puesto. En vez de solo mostrar la forma cruda,
      // se escanea la respuesta completa (sin recortar por dataPath) buscando
      // arreglos de objetos utilizables y se ofrecen como candidatas -- el
      // usuario elige la tabla con un clic, al estilo Power BI, en vez de
      // escribir la ruta a mano.
      const raw = instance.fetchRaw
        ? await instance.fetchRaw(params)
        : data;
      const tables = findTableCandidates(raw);
      const { preview, format } = buildResponsePreview(raw);

      return res.json({
        ok: false,
        error:
          tables.length > 0
            ? "La fuente devolvio una o mas tablas dentro de la respuesta. Elige cual usar."
            : "La fuente respondio, pero no se encontro ninguna lista de filas dentro.",
        received: preview,
        receivedFormat: format,
        tables,
        columns: [],
        rows: [],
        rowCount: 0,
        params,
      });
    }

    const objectRows = data.filter(
      (r): r is Record<string, unknown> => typeof r === "object" && r !== null
    );
    // Union de claves de la muestra: algunas fuentes omiten campos nulos en
    // ciertas filas, asi que mirar solo la primera perderia columnas.
    const columns = Array.from(
      new Set(objectRows.slice(0, SAMPLE_ROWS).flatMap((r) => Object.keys(r)))
    );

    res.json({
      ok: true,
      columns,
      rows: objectRows.slice(0, SAMPLE_ROWS),
      rowCount: data.length,
      params,
    });
  } catch (error: any) {
    res.json({
      ok: false,
      error: error.message ?? "Error desconocido",
      columns: [],
      rows: [],
      rowCount: 0,
      params: { ...defaultTestParams(), ...parseRuntimeParams(req.query) },
    });
  }
});

// Obtener datos en vivo del conector
router.get("/:id/data", async (req: Request, res: Response) => {
  try {
    // Lectura: admin (cualquiera) o custom con el conector dentro de un
    // dashboard que tiene asignado.
    if (!(await canReadConnector(req.params.id, req.userId!, req.userRole!))) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ?",
      [req.params.id]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const params = parseRuntimeParams(req.query);
    const columns = parseColumnsParam(req.query);
    const { rows: sourceRows } = await getRawRowsForConnector(connector, params, columns);

    const { data: rowsOut, truncated } = truncateRows(sourceRows);
    res.json({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      data: rowsOut,
      truncated,
    });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Configuracion de sincronizacion: que columna es la fecha (para sync
// incremental), cuantos dias de ventana relee hacia atras, y cada cuanto
// sincroniza solo (NULL = solo manual via POST /:id/sync).
router.put("/:id/sync-config", requireAdmin, async (req: Request, res: Response) => {
  const { dateColumn, syncWindowDays, syncIntervalMinutes } = req.body ?? {};
  try {
    const [result]: any = await pool.query(
      `UPDATE connectors
       SET date_column = ?, sync_window_days = ?, sync_interval_minutes = ?
       WHERE id = ? AND user_id = ?`,
      [
        dateColumn || null,
        syncWindowDays ?? 30,
        syncIntervalMinutes || null,
        req.params.id,
        req.userId,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }
    res.json({ ok: true });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Sincroniza el conector hacia el motor analitico (DuckDB): esta es la UNICA
// via por la que la API externa se consulta para "actualizar datos" -- el
// resto de la app (dashboards, /aggregate) lee lo ya sincronizado.
router.post("/:id/sync", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, type, config, date_column, sync_window_days
       FROM connectors WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    const connector = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const { from, to } = req.body ?? {};
    const result = await runSync(connector, from || to ? { from, to } : undefined);
    res.json({ status: "idle", ...result });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Estado de la ultima sincronizacion (para mostrar "actualizado hace X min").
router.get("/:id/sync", async (req: Request, res: Response) => {
  try {
    // Estado de solo lectura: visible para admin y para custom con acceso al
    // conector (para mostrar "actualizado hace X" en el visor).
    if (!(await canReadConnector(req.params.id, req.userId!, req.userRole!))) {
      return res.json({ status: "idle", last_sync_at: null, row_count: null });
    }
    const [rows]: any = await pool.query(
      `SELECT s.status, s.last_sync_at, s.last_watermark, s.row_count, s.last_error
       FROM sync_state s
       WHERE s.connector_id = ?`,
      [req.params.id]
    );
    res.json(rows[0] ?? { status: "idle", last_sync_at: null, row_count: null });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Agregacion server-side: el widget manda una spec y recibe solo el resultado
// agregado (KB), no las filas crudas (MB). Reusa el cache de /data (misma
// clave connectorId+params), asi que no golpea la fuente de mas.
router.post("/:id/aggregate", async (req: Request, res: Response) => {
  try {
    if (!(await canReadConnector(req.params.id, req.userId!, req.userRole!))) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ?",
      [req.params.id]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const params = parseRuntimeParams(req.body?.params);
    const filters = req.body?.activeFilters ?? {};
    const calc = req.body?.calculatedMeasures ?? [];
    const mode: "stat" | "tree" = req.body?.mode === "tree" ? "tree" : "stat";
    const query = req.body?.query ?? {};
    const result = await runAggregateCached(connector, params, filters, mode, query, calc);
    res.json(result);
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Valores unicos de una columna para los widgets de filtro. Se calculan en el
// servidor (SQL para columnas reales, evaluacion proyectada para calculadas)
// en vez de mandar las filas crudas al navegador.
router.post("/:id/distinct", async (req: Request, res: Response) => {
  try {
    if (!(await canReadConnector(req.params.id, req.userId!, req.userRole!))) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }
    const column = req.body?.column;
    if (!column || typeof column !== "string") {
      return res.status(400).json({ error: "Campo requerido: column" });
    }

    const [rows]: any = await pool.query("SELECT * FROM connectors WHERE id = ?", [
      req.params.id,
    ]);
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const params = parseRuntimeParams(req.body?.params);
    const calc = req.body?.calculatedMeasures ?? [];
    const result = await getDistinctValues(connector, column, params, calc);
    res.json(result);
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Preview: ejecutar query con LIMIT para ver primeras filas o error
router.post("/:id/preview", requireAdmin, async (req: Request, res: Response) => {
  const { query } = req.body ?? {};

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Campo requerido: query" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const config = decryptConfig(parseStoredConfig(connector.config));

    // Para conectores de BD, agregar LIMIT a la query
    let previewQuery = query;
    if (connector.type === "mysql" || connector.type === "postgresql") {
      // Evitar agregar LIMIT si ya lo tiene
      if (!query.toUpperCase().includes("LIMIT")) {
        previewQuery = `${query} LIMIT 10`;
      }
    }

    // Crear conector con la query de preview
    const previewConfig = { ...config, query: previewQuery };
    const instance = ConnectorFactory.create(connector.type, previewConfig);
    const data = await instance.fetchData();

    // Extraer columnas de la primera fila
    const firstRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const columns = firstRow ? Object.keys(firstRow) : [];

    res.json({
      success: true,
      columns,
      rows: Array.isArray(data) ? data : [],
      rowCount: Array.isArray(data) ? data.length : 0,
    });
  } catch (error: any) {
    // Devolver el error como respuesta exitosa pero con indicador de error
    res.json({
      success: false,
      error: error.message || "Error desconocido al ejecutar la query",
      columns: [],
      rows: [],
      rowCount: 0,
    });
  }
});

// Editar conector
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  const { name, config } = req.body ?? {};

  if (!name || !config) {
    return res.status(400).json({ error: "Campos requeridos: name, config" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    // Restaurar secretos enmascarados (sin cambios) desde la config previa
    const existingConfig = decryptConfig(
      parseStoredConfig(connector.config)
    ) as Record<string, unknown>;
    const mergedConfig = unmaskSecrets(connector.type, config, existingConfig);

    // Validar que la nueva config es utilizable
    ConnectorFactory.create(connector.type, mergedConfig);

    const encrypted = encryptConfig(mergedConfig);
    await pool.query(
      "UPDATE connectors SET name = ?, config = ? WHERE id = ? AND user_id = ?",
      [name, JSON.stringify(encrypted), req.params.id, req.userId]
    );

    // El cache se indexa por conector + filtros, no por config: sin esto, tras
    // cambiar la URL o la query se seguirian sirviendo los datos viejos hasta
    // que venza el TTL.
    await invalidateConnectorCache(connector.id);

    res.json({ id: connector.id, name, type: connector.type });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

// Eliminar conector
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      "DELETE FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }
    res.json({ deleted: true });
  } catch (error: any) {
    serverError(res, "connectors", error);
  }
});

export default router;
