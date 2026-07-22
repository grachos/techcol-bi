import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { pool } from "../db";

const TOKEN_TTL = "7d";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Nombre de la cookie de sesion (httpOnly: JavaScript nunca la lee). */
export const SESSION_COOKIE = "bi_session";

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
 * Entrega la sesion como cookie httpOnly en vez de mandar el token en el
 * cuerpo: asi un XSS no puede leerla desde document.cookie ni robar la sesion.
 *
 * sameSite 'lax' protege de CSRF -- el navegador no la manda en peticiones
 * cross-site que no sean navegaciones GET de nivel superior, y todas las
 * operaciones que cambian estado son POST/PUT/DELETE.
 * secure solo en produccion: en dev la app corre sobre http://localhost y una
 * cookie Secure no se guardaria.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
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
  // La cookie httpOnly es la via normal; el header Bearer se mantiene para
  // clientes que no son el navegador (scripts, pruebas).
  const header = req.headers.authorization;
  const token =
    req.cookies?.[SESSION_COOKIE] ??
    (header?.startsWith("Bearer ") ? header.slice(7) : null);

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
