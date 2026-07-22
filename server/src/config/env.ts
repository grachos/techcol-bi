import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET || "default_dev_jwt_secret_bi_techcol_key_123456789",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "bi_techcol",
  },
} as const;
