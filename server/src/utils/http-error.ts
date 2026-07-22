import type { Response } from "express";

/**
 * Responde un 500 sin filtrar internals al cliente.
 *
 * El detalle completo (stack, mensajes del driver SQL, rutas de archivos,
 * cadenas de conexion con credenciales) queda solo en el log del servidor;
 * el cliente recibe un mensaje generico. Devolver error.message crudo es
 * como se filtran nombres de tablas y datos de conexion hacia el navegador.
 */
export function serverError(res: Response, scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Error interno del servidor" });
}
