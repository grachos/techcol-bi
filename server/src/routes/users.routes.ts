import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// Todo el modulo de usuarios es exclusivo de administradores.
router.use(requireAuth, requireAdmin);

const ROLES = ["admin", "custom"] as const;
type Role = (typeof ROLES)[number];

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  status: "active" | "inactive";
  page_access: string | string[] | null;
  has_password: number;
}

function parsePages(raw: string | string[] | null): string[] {
  if (!raw) return [];
  const arr = typeof raw === "string" ? safeJson(raw) : raw;
  return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === "string") : [];
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Lee los IDs de dashboards asignados a un conjunto de usuarios de una sola vez. */
async function loadGrants(userIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (userIds.length === 0) return map;
  const [rows]: any = await pool.query(
    `SELECT user_id, dashboard_id FROM user_dashboard_access WHERE user_id IN (?)`,
    [userIds]
  );
  for (const r of rows as { user_id: number; dashboard_id: number }[]) {
    const list = map.get(r.user_id) ?? [];
    list.push(r.dashboard_id);
    map.set(r.user_id, list);
  }
  return map;
}

function publicUser(u: UserRow, dashboardIds: number[]) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    hasPassword: !!u.has_password,
    permissions: { dashboardIds, pageNames: parsePages(u.page_access) },
  };
}

/** Reemplaza los dashboards asignados a un usuario (semantica "todo o nada"). */
async function replaceGrants(
  conn: any,
  userId: number,
  dashboardIds: unknown
): Promise<void> {
  await conn.query("DELETE FROM user_dashboard_access WHERE user_id = ?", [userId]);
  const ids = Array.isArray(dashboardIds)
    ? [...new Set(dashboardIds.map(Number).filter((n) => Number.isInteger(n)))]
    : [];
  if (ids.length === 0) return;
  await conn.query(
    `INSERT INTO user_dashboard_access (user_id, dashboard_id) VALUES ${ids
      .map(() => "(?, ?)")
      .join(", ")}`,
    ids.flatMap((id) => [userId, id])
  );
}

function normalizePages(pageNames: unknown): string[] {
  if (!Array.isArray(pageNames)) return [];
  return [...new Set(pageNames.filter((p): p is string => typeof p === "string"))];
}

// Listar usuarios con sus permisos
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, email, name, role, status, page_access,
              (password_hash IS NOT NULL) AS has_password
       FROM users ORDER BY role DESC, name ASC`
    );
    const grants = await loadGrants((rows as UserRow[]).map((u) => u.id));
    res.json((rows as UserRow[]).map((u) => publicUser(u, grants.get(u.id) ?? [])));
  } catch (error: any) {
    console.error("[users] list", error);
    res.status(500).json({ error: "No se pudo listar usuarios" });
  }
});

// Crear usuario. La contrasena es opcional: sin ella queda pendiente de
// "primer ingreso" (el usuario la define con setup-password).
router.post("/", async (req: Request, res: Response) => {
  const { email, name, role, password, pageNames, dashboardIds } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email es requerido" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Rol invalido" });
  }
  if (password != null && (typeof password !== "string" || password.length < 8)) {
    return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hash = password ? await bcrypt.hash(password, 12) : null;
    const [result]: any = await conn.query(
      `INSERT INTO users (email, name, password_hash, role, status, page_access)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [email, name ?? null, hash, role, JSON.stringify(normalizePages(pageNames))]
    );
    const userId = result.insertId;
    if (role === "custom") await replaceGrants(conn, userId, dashboardIds);
    await conn.commit();
    res.status(201).json({ id: userId });
  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    console.error("[users] create", error);
    res.status(500).json({ error: "No se pudo crear el usuario" });
  } finally {
    conn.release();
  }
});

// Actualizar usuario (nombre, rol, estado, permisos y opcionalmente contrasena)
router.put("/:id", async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  const { name, role, status, password, pageNames, dashboardIds } = req.body ?? {};

  if (role != null && !ROLES.includes(role)) {
    return res.status(400).json({ error: "Rol invalido" });
  }
  if (status != null && status !== "active" && status !== "inactive") {
    return res.status(400).json({ error: "Estado invalido" });
  }
  if (password != null && (typeof password !== "string" || password.length < 8)) {
    return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" });
  }

  // No permitir que el ultimo admin activo se auto-degrade o desactive y deje
  // el sistema sin administradores.
  if (
    (role === "custom" || status === "inactive") &&
    !(await hasOtherActiveAdmin(targetId))
  ) {
    return res
      .status(409)
      .json({ error: "Debe existir al menos un administrador activo" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fields: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) (fields.push("name = ?"), values.push(name));
    if (role !== undefined) (fields.push("role = ?"), values.push(role));
    if (status !== undefined) (fields.push("status = ?"), values.push(status));
    if (pageNames !== undefined) {
      fields.push("page_access = ?");
      values.push(JSON.stringify(normalizePages(pageNames)));
    }
    if (password) {
      fields.push("password_hash = ?");
      values.push(await bcrypt.hash(password, 12));
    }
    if (fields.length > 0) {
      values.push(targetId);
      await conn.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    // Si queda como custom, se reescriben sus dashboards; si pasa a admin, se
    // limpian los grants (un admin ve todo, no necesita asignaciones).
    const effectiveRole = role ?? (await currentRole(conn, targetId));
    if (dashboardIds !== undefined && effectiveRole === "custom") {
      await replaceGrants(conn, targetId, dashboardIds);
    } else if (effectiveRole === "admin") {
      await conn.query("DELETE FROM user_dashboard_access WHERE user_id = ?", [targetId]);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (error: any) {
    await conn.rollback();
    console.error("[users] update", error);
    res.status(500).json({ error: "No se pudo actualizar el usuario" });
  } finally {
    conn.release();
  }
});

// Eliminar usuario
router.delete("/:id", async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  try {
    if (!(await hasOtherActiveAdmin(targetId))) {
      return res
        .status(409)
        .json({ error: "No se puede eliminar al ultimo administrador activo" });
    }
    await pool.query("DELETE FROM users WHERE id = ?", [targetId]);
    res.json({ ok: true });
  } catch (error: any) {
    console.error("[users] delete", error);
    res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});

/** ¿Existe algun admin activo distinto de `exceptId`? */
async function hasOtherActiveAdmin(exceptId: number): Promise<boolean> {
  const [rows]: any = await pool.query(
    "SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' AND id <> ? LIMIT 1",
    [exceptId]
  );
  return rows.length > 0;
}

async function currentRole(conn: any, userId: number): Promise<Role> {
  const [rows]: any = await conn.query("SELECT role FROM users WHERE id = ?", [userId]);
  return rows[0]?.role ?? "custom";
}

export default router;
