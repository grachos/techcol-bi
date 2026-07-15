import { Router, Request, Response } from "express";
import { pool } from "../db";
import { encryptConfig, decryptConfig, EncryptedPayload } from "../utils/encryption";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { CONNECTOR_TYPES, ConnectorType } from "../connectors/BaseConnector";

const router = Router();

// TODO: reemplazar por el usuario autenticado cuando exista auth real
const DEMO_USER_ID = 1;

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
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, type, created_at FROM connectors WHERE user_id = ? ORDER BY created_at DESC",
      [DEMO_USER_ID]
    );
    res.json(rows);
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
      [DEMO_USER_ID, name, type, JSON.stringify(encrypted)]
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
      [req.params.id, DEMO_USER_ID]
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
      [req.params.id, DEMO_USER_ID]
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

// Eliminar conector
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      "DELETE FROM connectors WHERE id = ? AND user_id = ?",
      [req.params.id, DEMO_USER_ID]
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
