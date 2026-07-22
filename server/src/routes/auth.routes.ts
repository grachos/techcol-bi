import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { signToken, requireAuth } from "../middleware/auth";

const router = Router();

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  password_hash: string | null;
}

/**
 * Devuelve el usuario con su rol y permisos (paginas + dashboards asignados).
 * Lo comparten login, setup-password y /me para que el cliente siempre reciba
 * la misma forma y pueda filtrar el menu / proteger rutas.
 */
async function loadSessionUser(userId: number) {
  const [rows]: any = await pool.query(
    "SELECT id, email, name, role, page_access FROM users WHERE id = ?",
    [userId]
  );
  const u = rows[0];
  if (!u) return null;

  let pageNames: string[] = [];
  if (u.page_access) {
    const parsed =
      typeof u.page_access === "string" ? JSON.parse(u.page_access) : u.page_access;
    if (Array.isArray(parsed)) pageNames = parsed.filter((p) => typeof p === "string");
  }

  const [grantRows]: any = await pool.query(
    "SELECT dashboard_id FROM user_dashboard_access WHERE user_id = ?",
    [userId]
  );

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    permissions: {
      pageNames,
      dashboardIds: grantRows.map((r: any) => r.dashboard_id),
    },
  };
}

// Iniciar sesion
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Campos requeridos: email, password" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT id, email, name, password_hash FROM users WHERE email = ?",
      [email]
    );
    const user: UserRow | undefined = rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = signToken(user.id);
    res.json({ token, user: await loadSessionUser(user.id) });
  } catch (error: any) {
    console.error("[auth] login", error);
    res.status(500).json({ error: "No se pudo iniciar sesion" });
  }
});

// Configurar la contrasena por primera vez. Solo funciona mientras el
// usuario no tenga una contrasena asignada (password_hash IS NULL) -- no es
// un registro abierto, es el arranque inicial de una cuenta ya existente.
router.post("/setup-password", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Campos requeridos: email, password" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "La contrasena debe tener al menos 8 caracteres" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT id, email, name, password_hash FROM users WHERE email = ?",
      [email]
    );
    const user: UserRow | undefined = rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (user.password_hash) {
      return res.status(409).json({
        error: "Esta cuenta ya tiene contrasena. Usa iniciar sesion.",
      });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      hash,
      user.id,
    ]);

    const token = signToken(user.id);
    res.json({ token, user: await loadSessionUser(user.id) });
  } catch (error: any) {
    console.error("[auth] setup-password", error);
    res.status(500).json({ error: "No se pudo configurar la contrasena" });
  }
});

// Usuario actual (para restaurar sesion al recargar la app). Incluye rol y
// permisos para que el cliente filtre el menu y proteja las rutas.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await loadSessionUser(req.userId!);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (error: any) {
    console.error("[auth] me", error);
    res.status(500).json({ error: "No se pudo obtener el usuario" });
  }
});

export default router;
