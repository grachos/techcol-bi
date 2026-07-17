import { Router, Request, Response } from "express";
import { pool } from "../db";
import { encryptConfig, decryptConfig, EncryptedPayload } from "../utils/encryption";
import { maskSecrets, unmaskSecrets } from "../utils/security";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { CONNECTOR_TYPES, ConnectorType } from "../connectors/BaseConnector";

const router = Router();

// TODO: reemplazar por el usuario autenticado cuando exista auth real

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

// Probar conexion de un conector existente
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
    const ok = await instance.testConnection();
    res.json({ ok });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

    const config = decryptConfig(parseStoredConfig(connector.config));
    const instance = ConnectorFactory.create(connector.type, config);
    const data = await instance.fetchData();

    res.json({ id: connector.id, name: connector.name, type: connector.type, data });
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
