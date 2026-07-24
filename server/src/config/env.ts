import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";

/**
 * El secreto del JWT firma las cookies de sesion: si un atacante lo conoce,
 * puede forjar una sesion para cualquier userId (incluido un admin). Por eso
 * NUNCA hay un valor por defecto en produccion -- si falta, el proceso no
 * arranca. En desarrollo se genera uno efimero por arranque (las sesiones se
 * invalidan al reiniciar, que es lo aceptable en local).
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (nodeEnv === "production") {
    throw new Error(
      "JWT_SECRET no configurado (o demasiado corto): define un secreto de >=32 caracteres en el entorno antes de arrancar en produccion."
    );
  }
  console.warn(
    "[env] JWT_SECRET no definido: usando un secreto efimero de desarrollo (las sesiones no sobreviven a un reinicio)."
  );
  return crypto.randomBytes(48).toString("hex");
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  jwtSecret: resolveJwtSecret(),
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "bi_techcol",
  },
} as const;
