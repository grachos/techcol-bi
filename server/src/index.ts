import express from "express";
import cors from "cors";
import { config } from "./config/env";
import { pingDb } from "./db";
import connectorsRoutes from "./routes/connectors.routes";
import dashboardsRoutes from "./routes/dashboards.routes";
import aiRoutes from "./routes/ai.routes";

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
  })
);
app.use(express.json({ limit: "1mb" }));

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

app.listen(config.port, () => {
  console.log(`BI-TechCol API corriendo en http://localhost:${config.port}`);
  console.log(`  Salud:      http://localhost:${config.port}/api/health`);
  console.log(`  Conectores: http://localhost:${config.port}/api/connectors`);
  console.log(`  Dashboards: http://localhost:${config.port}/api/dashboards`);
  console.log(`  IA:         http://localhost:${config.port}/api/ai/suggest-widget`);
});
