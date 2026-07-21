import dns from "dns/promises";
import net from "net";

// Backstop puro contra OOM, NO un limite de negocio. 10000 se quedaba corto y
// -- peor -- cortaba SILENCIOSAMENTE a mitad del rango: un año de Silog son
// ~36k filas ordenadas por fecha, asi que el corte a 10000 dejaba solo los
// primeros ~4 meses y el dashboard parecia "no traer el resto del año".
// Se sube a un techo que cubre rangos multi-año reales; si de verdad se
// alcanza, se avisa (abajo) en vez de mentir con datos incompletos.
// ponytail: techo fijo en memoria del cliente; el fix escalable de verdad
// para volumenes enormes es agregar del lado del servidor (GROUP BY en la
// fuente) en vez de mandar filas crudas al navegador.
const MAX_ROWS = 200000;

export interface TruncateResult<T> {
  data: T;
  truncated: boolean;
}

/**
 * Recorta la respuesta de un conector a MAX_ROWS filas SOLO como proteccion
 * de memoria (fuentes REST/Sheets/Excel sin LIMIT propio; los SQL ya limitan
 * via la query del usuario). Devuelve `truncated` para que la ruta pueda
 * avisar al cliente en vez de servir un rango cortado en silencio.
 */
export function truncateRows<T = unknown>(data: T): TruncateResult<T> {
  if (Array.isArray(data) && data.length > MAX_ROWS) {
    return { data: data.slice(0, MAX_ROWS) as unknown as T, truncated: true };
  }
  return { data, truncated: false };
}

/**
 * Marca que reemplaza a un secreto ya guardado cuando la config se envia al
 * navegador. Al editar, si el campo vuelve con esta marca significa "sin
 * cambios" y el servidor conserva el valor cifrado existente.
 */
export const SECRET_MASK = "__SECRET_STORED__";

/** Campos sensibles por tipo de conector que nunca deben salir en claro. */
const SECRET_FIELDS: Record<string, string[]> = {
  mysql: ["password"],
  postgresql: ["password"],
  google_sheets: ["serviceAccountKey"],
  rest_api: ["headers", "authBody", "authHeaders"],
};

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** Sustituye los secretos por SECRET_MASK antes de responder al cliente. */
export function maskSecrets(
  type: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...config };
  for (const field of SECRET_FIELDS[type] ?? []) {
    if (hasValue(out[field])) out[field] = SECRET_MASK;
  }
  return out;
}

/**
 * Restaura los secretos enmascarados usando la config existente. Un campo con
 * SECRET_MASK (o ausente cuando antes existia) se toma del valor previo.
 */
export function unmaskSecrets(
  type: string,
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...incoming };
  for (const field of SECRET_FIELDS[type] ?? []) {
    if (out[field] === SECRET_MASK) out[field] = existing[field];
  }
  return out;
}

/** Rangos IP privados/reservados que no deben ser alcanzables desde un conector. */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local (metadata cloud)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1") return true; // loopback
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // IPv4 mapeada
    return false;
  }
  return false;
}

/**
 * Bloquea SSRF: rechaza URLs que no sean http(s) o que apunten a la red
 * interna / loopback / endpoints de metadata. Resuelve el DNS y valida la IP
 * real, no solo el hostname literal.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL invalida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http(s)");
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("No se permite acceder a hosts internos");
  }

  // Si el host ya es una IP, validarla directo; si no, resolver DNS.
  const literals = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true })).map((a) => a.address);

  for (const ip of literals) {
    if (isPrivateIp(ip)) {
      throw new Error("No se permite acceder a direcciones de red interna");
    }
  }
}
