import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { pingDb } from "./db";
import { requireAuth, requireAdmin } from "./middleware/auth";
import authRoutes from "./routes/auth.routes";
import connectorsRoutes from "./routes/connectors.routes";
import dashboardsRoutes from "./routes/dashboards.routes";
import usersRoutes from "./routes/users.routes";
import aiRoutes from "./routes/ai.routes";
import { startSyncScheduler } from "./services/sync-service";

const app = express();

// Cabeceras de seguridad (CSP, no-sniff, etc.)
app.use(helmet());
app.use(compression());
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

// Autenticacion (limite mas estricto para frenar fuerza bruta)
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 60_000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos, intenta mas tarde" },
  }),
  authRoutes
);

// Conectores dinamicos. requireAuth expone el rol; el propio router decide
// que rutas son de gestion (admin) y cuales de solo lectura (custom con grant).
app.use("/api/connectors", requireAuth, connectorsRoutes);

// Dashboards personalizables (la vista /share/:token es publica; el propio
// router aplica requireAuth solo al resto de sus rutas)
app.use("/api/dashboards", dashboardsRoutes);

// Gestion de usuarios: exclusiva de administradores (el router aplica el guard)
app.use("/api/users", usersRoutes);

// Copiloto de IA (Groq): construye/edita widgets, solo administradores
app.use("/api/ai", requireAuth, requireAdmin, aiRoutes);

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

// Programador de sincronizacion: revisa cada 60s que conectores con
// sync_interval_minutes configurado ya vencieron y los sincroniza.
startSyncScheduler();
