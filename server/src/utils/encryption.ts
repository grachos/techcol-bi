import crypto from "crypto";
import { config } from "../config/env";

/**
 * Cifrado AES-256-GCM para credenciales de conectores.
 * Las credenciales NUNCA llegan al navegador: se cifran aqui
 * y solo el servidor puede descifrarlas.
 *
 * ENCRYPTION_KEY: 32 bytes en hex (64 caracteres).
 */

export interface EncryptedPayload {
  iv: string;
  data: string;
  tag: string;
}

function getKey(): Buffer {
  const key = config.encryptionKey;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY invalida: define 32 bytes en hex (64 caracteres) en .env"
    );
  }
  return Buffer.from(key, "hex");
}

export function encryptConfig(configObj: unknown): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const plaintext = JSON.stringify(configObj);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptConfig<T = any>(payload: EncryptedPayload): T {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(payload.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
