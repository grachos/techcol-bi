import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

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

/** Exige un JWT valido en Authorization: Bearer <token> y expone req.userId. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Sesion invalida o expirada" });
  }
}
