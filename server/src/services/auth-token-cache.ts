import crypto from "crypto";

/**
 * Cache en memoria de los tokens del auth encadenado (Paso 1). Sin esto,
 * cada fetchData() re-autenticaba contra el servicio externo: N widgets
 * refrescando = N logins por ciclo.
 *
 * El token vive solo en el servidor: nunca se serializa hacia el navegador.
 */

interface Entry {
  token: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

/** TTL por defecto cuando el servicio no declara expiracion. */
const DEFAULT_TTL_MS = 10 * 60_000;

/**
 * Llave estable derivada de la config de auth (no del id del conector): dos
 * conectores con las mismas credenciales comparten token, y cambiar la
 * contraseña invalida la entrada automaticamente.
 */
function cacheKey(authUrl: string, authBody: unknown): string {
  return crypto
    .createHash("sha256")
    .update(`${authUrl}|${JSON.stringify(authBody ?? null)}`)
    .digest("hex");
}

export function getCachedToken(
  authUrl: string,
  authBody: unknown
): string | null {
  const entry = cache.get(cacheKey(authUrl, authBody));
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(cacheKey(authUrl, authBody));
    return null;
  }
  return entry.token;
}

export function setCachedToken(
  authUrl: string,
  authBody: unknown,
  token: string,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  cache.set(cacheKey(authUrl, authBody), {
    token,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Invalida el token tras un 401: la proxima llamada vuelve a autenticar. */
export function invalidateToken(authUrl: string, authBody: unknown): void {
  cache.delete(cacheKey(authUrl, authBody));
}
