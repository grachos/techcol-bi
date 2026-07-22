import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { pool } from "../db";

const TOKEN_TTL = "7d";

export interface TokenPayload {
  userId: number;
}

export function signToken(userId: number): string {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET no configurado en .env");
  }
  return jwt.sign({ userId } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: TOKEN_TTL,
  });
}

/**
 * Exige un JWT valido en Authorization: Bearer <token> y expone req.userId y
 * req.userRole. Verifica en la BD que la cuenta siga existiendo y activa: asi
 * un usuario desactivado o borrado pierde el acceso al instante, sin esperar a
 * que expire su token de 7 dias.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    const [rows]: any = await pool.query(
      "SELECT id, role, status FROM users WHERE id = ?",
      [payload.userId]
    );
    const user = rows[0];
    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Sesion invalida o expirada" });
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ error: "Sesion invalida o expirada" });
  }
}

/** Restringe una ruta a administradores. Debe ir despues de requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Requiere permisos de administrador" });
  }
  next();
}
