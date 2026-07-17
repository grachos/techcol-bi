import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { pingDb } from "./db";
import connectorsRoutes from "./routes/connectors.routes";
import dashboardsRoutes from "./routes/dashboards.routes";
import aiRoutes from "./routes/ai.routes";

const app = express();

// Cabeceras de seguridad (CSP, no-sniff, etc.)
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
  })
);
app.use(express.json({ limit: "1mb" }));

// Limite de peticiones por IP para mitigar abuso / fuerza bruta
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones, intenta mas tarde" },
  })
);

// Salud del servicio
app.get("/api/health", async (_req, res) => {
  const dbOk = await pingDb();
  res.json({ status: "ok", service: "bi-techcol", db: dbOk ? "up" : "down" });
});

// Conectores dinamicos
app.use("/api/connectors", connectorsRoutes);

// Dashboards personalizables
app.use("/api/dashboards", dashboardsRoutes);

// Copiloto de IA (Groq)
app.use("/api/ai", aiRoutes);

// Manejador global: registra el detalle en el servidor y responde generico
// para no filtrar internals al cliente.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(config.port, () => {
  console.log(`BI-TechCol API corriendo en http://localhost:${config.port}`);
  console.log(`  Salud:      http://localhost:${config.port}/api/health`);
  console.log(`  Conectores: http://localhost:${config.port}/api/connectors`);
  console.log(`  Dashboards: http://localhost:${config.port}/api/dashboards`);
  console.log(`  IA:         http://localhost:${config.port}/api/ai/suggest-widget`);
});
