import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { pool } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { canReadDashboard } from "../services/access";
import { truncateRows } from "../utils/security";
import { parseRuntimeParams, parseColumnsParam } from "../utils/runtime-params";
import { runAggregateCached } from "../services/cached-aggregate";
import { getRawRowsForConnector } from "../services/rows-source";
import { ConnectorType } from "../connectors/BaseConnector";

const router = Router();

const CHART_TYPES = ["bar", "line", "area", "pie", "table"] as const;
type ChartType = (typeof CHART_TYPES)[number];

const WIDGET_KINDS = [
  "chart",
  "stat",
  "calendar",
  "clock",
  "filter_date",
  "filter_select",
  "progress",
  "map",
  "combo",
  "tree_grid",
] as const;
type WidgetKind = (typeof WIDGET_KINDS)[number];

const AGGREGATIONS = ["sum", "avg", "count", "min", "max"] as const;
type Aggregation = (typeof AGGREGATIONS)[number];

const WIDGET_COLORS = [
  "primary",
  "pink",
  "blue",
  "green",
  "orange",
  "purple",
  "teal",
] as const;
type WidgetColor = (typeof WIDGET_COLORS)[number];

// 'clock' no necesita un conector; los demas kinds funcionan mejor con uno
// (calendar y filter_date lo usan solo como sugerencia, no es estrictamente obligatorio)
const KINDS_REQUIRING_CONNECTOR: WidgetKind[] = [
  "chart",
  "stat",
  "filter_select",
  "progress",
  "map",
  "combo",
  "tree_grid",
];

interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WidgetRow {
  id: number;
  dashboard_id: number;
  connector_id: number | null;
  connector_name: string | null;
  connector_type: string | null;
  kind: WidgetKind;
  title: string;
  chart_type: ChartType;
  color: WidgetColor;
  x_key: string | null;
  y_key: string | null;
  aggregation: Aggregation | null;
  target_value: string | number | null;
  target_label: string | null;
  filter_column: string | null;
  layout: string | WidgetLayout;
}

function parseLayout(raw: string | WidgetLayout): WidgetLayout {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function parseFilters(raw: string | Record<string, unknown> | null): Record<string, unknown> {
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function serializeTags(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  const clean = tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return clean.length > 0 ? clean.join(",") : null;
}

// Modelo de pool compartido: los dashboards los gestionan los admin (las rutas
// de escritura ya estan detras de requireAdmin), asi que basta comprobar que el
// dashboard exista, sin atarlo al user_id de quien lo creo.
async function assertDashboardExists(
  dashboardId: string | number
): Promise<boolean> {
  const [rows]: any = await pool.query(
    "SELECT id FROM dashboards WHERE id = ? LIMIT 1",
    [dashboardId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------
// Rutas publicas (dashboard compartido): deben quedar ANTES de requireAuth
// ---------------------------------------------------------------------

// Obtener dashboard compartido (acceso público sin autenticación)
router.get("/share/:token", async (req: Request, res: Response) => {
  try {
    const [shareRows]: any = await pool.query(
      "SELECT dashboard_id FROM dashboard_shares WHERE share_token = ?",
      [req.params.token]
    );

    if (shareRows.length === 0) {
      return res.status(404).json({ error: "Link compartible no válido" });
    }

    const dashboardId = shareRows[0].dashboard_id;

    const [dashRows]: any = await pool.query(
      "SELECT id, name, created_at, last_filters FROM dashboards WHERE id = ?",
      [dashboardId]
    );

    if (dashRows.length === 0) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    const dashboard = {
      id: dashRows[0].id,
      name: dashRows[0].name,
      created_at: dashRows[0].created_at,
      lastFilters: parseFilters(dashRows[0].last_filters),
      isShared: true,
    };

    const [widgetRows]: any = await pool.query(
      `SELECT w.id, w.dashboard_id, w.connector_id, w.kind, w.title, w.chart_type, w.color,
              w.x_key, w.y_key, w.aggregation, w.target_value, w.target_label, w.filter_column, w.layout,
              c.name AS connector_name, c.type AS connector_type
       FROM dashboard_widgets w
       LEFT JOIN connectors c ON c.id = w.connector_id
       WHERE w.dashboard_id = ?
       ORDER BY w.id ASC`,
      [dashboardId]
    );

    const widgets = (widgetRows as WidgetRow[]).map((w) => ({
      id: w.id,
      connectorId: w.connector_id,
      connectorName: w.connector_name,
      connectorType: w.connector_type,
      kind: w.kind,
      title: w.title,
      chartType: w.chart_type,
      color: w.color,
      xKey: w.x_key,
      yKey: w.y_key,
      aggregation: w.aggregation,
      targetValue: w.target_value === null ? null : Number(w.target_value),
      targetLabel: w.target_label,
      filterColumn: w.filter_column,
      layout: parseLayout(w.layout),
    }));

    res.json({ ...dashboard, widgets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Datos en vivo de un conector para la vista compartida: valida el token y
// que el conector pertenezca a un widget de ese dashboard, sin exponer el
// resto de la API de conectores.
router.get(
  "/share/:token/connectors/:connectorId/data",
  async (req: Request, res: Response) => {
    try {
      const [rows]: any = await pool.query(
        `SELECT c.id, c.type, c.config, c.date_column
         FROM dashboard_shares s
         JOIN dashboard_widgets w
           ON w.dashboard_id = s.dashboard_id AND w.connector_id = ?
         JOIN connectors c ON c.id = w.connector_id
         WHERE s.share_token = ?
         LIMIT 1`,
        [req.params.connectorId, req.params.token]
      );
      const connector = rows[0];
      if (!connector) {
        return res.status(404).json({ error: "Conector no encontrado" });
      }

      const params = parseRuntimeParams(req.query);
      const columns = parseColumnsParam(req.query);
      const { rows: sourceRows } = await getRawRowsForConnector(
        { id: connector.id, type: connector.type as ConnectorType, config: connector.config, date_column: connector.date_column },
        params,
        columns
      );

      const { data: rowsOut, truncated } = truncateRows(sourceRows);
      res.json({ id: connector.id, type: connector.type, data: rowsOut, truncated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Agregacion server-side para la vista compartida (equivalente publico de
// POST /connectors/:id/aggregate).
router.post(
  "/share/:token/connectors/:connectorId/aggregate",
  async (req: Request, res: Response) => {
    try {
      const [rows]: any = await pool.query(
        `SELECT c.id, c.type, c.config
         FROM dashboard_shares s
         JOIN dashboard_widgets w
           ON w.dashboard_id = s.dashboard_id AND w.connector_id = ?
         JOIN connectors c ON c.id = w.connector_id
         WHERE s.share_token = ?
         LIMIT 1`,
        [req.params.connectorId, req.params.token]
      );
      const connector = rows[0];
      if (!connector) {
        return res.status(404).json({ error: "Conector no encontrado" });
      }

      const params = parseRuntimeParams(req.body?.params);
      const filters = req.body?.activeFilters ?? {};
      const calc = req.body?.calculatedMeasures ?? [];
      const mode: "stat" | "tree" = req.body?.mode === "tree" ? "tree" : "stat";
      const query = req.body?.query ?? {};
      const result = await runAggregateCached(
        { id: connector.id, type: connector.type as ConnectorType, config: connector.config },
        params,
        filters,
        mode,
        query,
        calc
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ---------------------------------------------------------------------
// A partir de aqui, todas las rutas requieren sesion
// ---------------------------------------------------------------------
router.use(requireAuth);

// Listar dashboards. Admin: todos (gestiona el pool completo). Custom: solo
// los que un admin le asigno.
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows]: any =
      req.userRole === "admin"
        ? await pool.query(
            "SELECT id, name, is_favorite, tags, created_at, last_queried_at FROM dashboards ORDER BY created_at ASC"
          )
        : await pool.query(
            `SELECT d.id, d.name, d.is_favorite, d.tags, d.created_at, d.last_queried_at
             FROM dashboards d
             JOIN user_dashboard_access a ON a.dashboard_id = d.id AND a.user_id = ?
             ORDER BY d.created_at ASC`,
            [req.userId]
          );
    res.json(
      rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        isFavorite: !!r.is_favorite,
        tags: parseTags(r.tags),
        created_at: r.created_at,
        lastQueriedAt: r.last_queried_at,
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Crear dashboard (solo admin)
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { name, tags } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Campo requerido: name" });
  }
  try {
    const [result]: any = await pool.query(
      "INSERT INTO dashboards (user_id, name, tags) VALUES (?, ?, ?)",
      [req.userId, name, serializeTags(tags)]
    );
    res.status(201).json({ id: result.insertId, name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un dashboard con sus widgets (incluye datos del conector para mostrar tipo/nombre)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canReadDashboard(req.params.id, req.userId!, req.userRole!))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    const [dashRows]: any = await pool.query(
      "SELECT id, name, is_favorite, tags, created_at, last_filters, last_queried_at FROM dashboards WHERE id = ?",
      [req.params.id]
    );
    if (dashRows.length === 0) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    const dashboard = {
      id: dashRows[0].id,
      name: dashRows[0].name,
      isFavorite: !!dashRows[0].is_favorite,
      tags: parseTags(dashRows[0].tags),
      created_at: dashRows[0].created_at,
      lastFilters: parseFilters(dashRows[0].last_filters),
      lastQueriedAt: dashRows[0].last_queried_at,
    };

    const [widgetRows]: any = await pool.query(
      `SELECT w.id, w.dashboard_id, w.connector_id, w.kind, w.title, w.chart_type, w.color,
              w.x_key, w.y_key, w.aggregation, w.target_value, w.target_label, w.filter_column, w.layout,
              c.name AS connector_name, c.type AS connector_type
       FROM dashboard_widgets w
       LEFT JOIN connectors c ON c.id = w.connector_id
       WHERE w.dashboard_id = ?
       ORDER BY w.id ASC`,
      [req.params.id]
    );

    const widgets = (widgetRows as WidgetRow[]).map((w) => ({
      id: w.id,
      connectorId: w.connector_id,
      connectorName: w.connector_name,
      connectorType: w.connector_type,
      kind: w.kind,
      title: w.title,
      chartType: w.chart_type,
      color: w.color,
      xKey: w.x_key,
      yKey: w.y_key,
      aggregation: w.aggregation,
      targetValue: w.target_value === null ? null : Number(w.target_value),
      targetLabel: w.target_label,
      filterColumn: w.filter_column,
      layout: parseLayout(w.layout),
    }));

    res.json({ ...dashboard, widgets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar dashboard: nombre, favorito y/o tags (solo admin)
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  const { name, isFavorite, tags } = req.body ?? {};

  const fields: string[] = [];
  const values: unknown[] = [];
  if (name !== undefined) {
    if (!name) {
      return res.status(400).json({ error: "El nombre no puede estar vacio" });
    }
    fields.push("name = ?");
    values.push(name);
  }
  if (isFavorite !== undefined) {
    fields.push("is_favorite = ?");
    values.push(!!isFavorite);
  }
  if (tags !== undefined) {
    fields.push("tags = ?");
    values.push(serializeTags(tags));
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: "Nada para actualizar" });
  }

  try {
    values.push(req.params.id);
    const [result]: any = await pool.query(
      `UPDATE dashboards SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    res.json({ id: Number(req.params.id) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar la ultima consulta (filtros activos) aplicada en el dashboard.
// Se usa para que /dashboard, /dashboard/:id y el link compartido siempre
// muestren la misma ultima consulta, sin depender de localStorage.
router.put("/:id/last-query", requireAdmin, async (req: Request, res: Response) => {
  const { filters } = req.body ?? {};
  try {
    const [result]: any = await pool.query(
      "UPDATE dashboards SET last_filters = ?, last_queried_at = NOW() WHERE id = ?",
      [JSON.stringify(filters ?? {}), req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    res.json({ saved: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar dashboard (solo admin)
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      "DELETE FROM dashboards WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar widget a un dashboard
router.post("/:id/widgets", requireAdmin, async (req: Request, res: Response) => {
  const {
    connectorId,
    title,
    kind = "chart",
    chartType = "bar",
    color = "primary",
    xKey,
    yKey,
    aggregation,
    targetValue,
    targetLabel,
    filterColumn,
    layout,
  } = req.body ?? {};

  if (!title || !layout) {
    return res.status(400).json({
      error: "Campos requeridos: title, layout",
    });
  }
  if (!WIDGET_KINDS.includes(kind)) {
    return res.status(400).json({
      error: `Tipo de widget invalido. Soportados: ${WIDGET_KINDS.join(", ")}`,
    });
  }
  if (kind === "chart" && !CHART_TYPES.includes(chartType)) {
    return res.status(400).json({
      error: `Tipo de grafica invalido. Soportados: ${CHART_TYPES.join(", ")}`,
    });
  }
  if (!WIDGET_COLORS.includes(color)) {
    return res.status(400).json({
      error: `Color invalido. Soportados: ${WIDGET_COLORS.join(", ")}`,
    });
  }
  if (aggregation && !AGGREGATIONS.includes(aggregation)) {
    return res.status(400).json({
      error: `Agregacion invalida. Soportadas: ${AGGREGATIONS.join(", ")}`,
    });
  }
  if (KINDS_REQUIRING_CONNECTOR.includes(kind) && !connectorId) {
    return res.status(400).json({
      error: `El tipo de widget "${kind}" requiere un conector`,
    });
  }

  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO dashboard_widgets
        (dashboard_id, connector_id, kind, title, chart_type, color, x_key, y_key, aggregation, target_value, target_label, filter_column, layout)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        connectorId ?? null,
        kind,
        title,
        chartType,
        color,
        xKey ?? null,
        yKey ?? null,
        aggregation ?? null,
        targetValue ?? null,
        targetLabel ?? null,
        filterColumn ?? null,
        JSON.stringify(layout),
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar widget (config y/o layout individual)
router.put("/:id/widgets/:widgetId", requireAdmin, async (req: Request, res: Response) => {
  const {
    title,
    chartType,
    color,
    xKey,
    yKey,
    aggregation,
    targetValue,
    targetLabel,
    filterColumn,
    layout,
  } = req.body ?? {};

  if (chartType !== undefined && !CHART_TYPES.includes(chartType)) {
    return res.status(400).json({
      error: `Tipo de grafica invalido. Soportados: ${CHART_TYPES.join(", ")}`,
    });
  }
  if (color !== undefined && !WIDGET_COLORS.includes(color)) {
    return res.status(400).json({
      error: `Color invalido. Soportados: ${WIDGET_COLORS.join(", ")}`,
    });
  }
  if (aggregation && !AGGREGATIONS.includes(aggregation)) {
    return res.status(400).json({
      error: `Agregacion invalida. Soportadas: ${AGGREGATIONS.join(", ")}`,
    });
  }

  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title);
    }
    if (chartType !== undefined) {
      fields.push("chart_type = ?");
      values.push(chartType);
    }
    if (color !== undefined) {
      fields.push("color = ?");
      values.push(color);
    }
    if (xKey !== undefined) {
      fields.push("x_key = ?");
      values.push(xKey);
    }
    if (yKey !== undefined) {
      fields.push("y_key = ?");
      values.push(yKey);
    }
    if (aggregation !== undefined) {
      fields.push("aggregation = ?");
      values.push(aggregation);
    }
    if (targetValue !== undefined) {
      fields.push("target_value = ?");
      values.push(targetValue);
    }
    if (targetLabel !== undefined) {
      fields.push("target_label = ?");
      values.push(targetLabel);
    }
    if (filterColumn !== undefined) {
      fields.push("filter_column = ?");
      values.push(filterColumn);
    }
    if (layout !== undefined) {
      fields.push("layout = ?");
      values.push(JSON.stringify(layout));
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: "Nada para actualizar" });
    }

    values.push(req.params.widgetId, req.params.id);
    const [result]: any = await pool.query(
      `UPDATE dashboard_widgets SET ${fields.join(", ")} WHERE id = ? AND dashboard_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Widget no encontrado" });
    }
    res.json({ updated: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar posiciones de varios widgets a la vez (tras arrastrar/redimensionar)
router.put("/:id/layout", requireAdmin, async (req: Request, res: Response) => {
  const items: { id: number; x: number; y: number; w: number; h: number }[] =
    req.body?.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Campo requerido: items[]" });
  }

  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    await Promise.all(
      items.map((item) =>
        pool.query(
          "UPDATE dashboard_widgets SET layout = ? WHERE id = ? AND dashboard_id = ?",
          [
            JSON.stringify({ x: item.x, y: item.y, w: item.w, h: item.h }),
            item.id,
            req.params.id,
          ]
        )
      )
    );
    res.json({ updated: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar widget
router.delete("/:id/widgets/:widgetId", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    const [result]: any = await pool.query(
      "DELETE FROM dashboard_widgets WHERE id = ? AND dashboard_id = ?",
      [req.params.widgetId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Widget no encontrado" });
    }
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generar o obtener link compartible del dashboard
router.post("/:id/share", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    // Verificar si ya existe un share token
    const [existingShare]: any = await pool.query(
      "SELECT share_token FROM dashboard_shares WHERE dashboard_id = ?",
      [req.params.id]
    );

    if (existingShare.length > 0) {
      return res.json({ shareToken: existingShare[0].share_token });
    }

    // Generar nuevo token único
    const shareToken = randomBytes(32).toString("hex");

    await pool.query(
      "INSERT INTO dashboard_shares (dashboard_id, share_token) VALUES (?, ?)",
      [req.params.id, shareToken]
    );

    res.json({ shareToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Revocar el link compartible del dashboard
router.delete("/:id/share", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!(await assertDashboardExists(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }
    await pool.query("DELETE FROM dashboard_shares WHERE dashboard_id = ?", [
      req.params.id,
    ]);
    res.json({ revoked: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
