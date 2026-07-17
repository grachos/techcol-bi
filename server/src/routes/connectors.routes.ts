import { Router, Request, Response } from "express";
import { pool } from "../db";
import { encryptConfig, decryptConfig, EncryptedPayload } from "../utils/encryption";
import { maskSecrets, unmaskSecrets, truncateRows } from "../utils/security";
import { parseRuntimeParams } from "../utils/runtime-params";
import {
  getCachedConnectorData,
  invalidateConnectorCache,
} from "../services/connector-cache";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { CONNECTOR_TYPES, ConnectorType } from "../connectors/BaseConnector";

const router = Router();

interface ConnectorRow {
  id: number;
  user_id: number;
  name: string;
  type: ConnectorType;
  config: string | EncryptedPayload;
  created_at: string;
}

function parseStoredConfig(raw: string | EncryptedPayload): EncryptedPayload {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Listar conectores (sin credenciales)
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, type, created_at FROM connectors WHERE user_id = ? ORDER BY created_at DESC",
      [req.userId]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un conector específico con su configuración desencriptada
router.get("/:id", async (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
  }
});

// Crear conector: cifra las credenciales antes de guardar
router.post("/", async (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
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
router.post("/:id/test", async (req: Request, res: Response) => {
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
      // un dataPath mal puesto, asi que se muestra lo que llego para poder
      // ver donde estan realmente los datos.
      return res.json({
        ok: false,
        error:
          "La fuente respondio, pero no devolvio una lista de filas. Revisa 'Data path'.",
        received: JSON.stringify(data).slice(0, 400),
        columns: [],
        rows: [],
        rowCount: 0,
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
    const [rows]: any = await pool.query(
      "SELECT * FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, req.userId]
    );
    const connector: ConnectorRow | undefined = rows[0];
    if (!connector) {
      return res.status(404).json({ error: "Conector no encontrado" });
    }

    const params = parseRuntimeParams(req.query);
    const data = await getCachedConnectorData(connector.id, params, async () => {
      const config = decryptConfig(parseStoredConfig(connector.config));
      const instance = ConnectorFactory.create(connector.type, config);
      return instance.fetchData(params);
    });

    res.json({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      data: truncateRows(data),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Preview: ejecutar query con LIMIT para ver primeras filas o error
router.post("/:id/preview", async (req: Request, res: Response) => {
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
router.put("/:id", async (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
  }
});

// Eliminar conector
router.delete("/:id", async (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
  }
});

export default router;
