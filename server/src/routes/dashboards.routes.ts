import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// TODO: reemplazar por el usuario autenticado cuando exista auth real
const DEMO_USER_ID = 1;

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
  filter_column: string | null;
  layout: string | WidgetLayout;
}

function parseLayout(raw: string | WidgetLayout): WidgetLayout {
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

async function assertDashboardOwnership(
  dashboardId: string | number
): Promise<boolean> {
  const [rows]: any = await pool.query(
    "SELECT id FROM dashboards WHERE id = ? AND user_id = ?",
    [dashboardId, DEMO_USER_ID]
  );
  return rows.length > 0;
}

// Listar dashboards del usuario
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT id, name, is_favorite, tags, created_at FROM dashboards WHERE user_id = ? ORDER BY created_at ASC",
      [DEMO_USER_ID]
    );
    res.json(
      rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        isFavorite: !!r.is_favorite,
        tags: parseTags(r.tags),
        created_at: r.created_at,
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Crear dashboard
router.post("/", async (req: Request, res: Response) => {
  const { name, tags } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Campo requerido: name" });
  }
  try {
    const [result]: any = await pool.query(
      "INSERT INTO dashboards (user_id, name, tags) VALUES (?, ?, ?)",
      [DEMO_USER_ID, name, serializeTags(tags)]
    );
    res.status(201).json({ id: result.insertId, name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un dashboard con sus widgets (incluye datos del conector para mostrar tipo/nombre)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const [dashRows]: any = await pool.query(
      "SELECT id, name, is_favorite, tags, created_at FROM dashboards WHERE id = ? AND user_id = ?",
      [req.params.id, DEMO_USER_ID]
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
    };

    const [widgetRows]: any = await pool.query(
      `SELECT w.id, w.dashboard_id, w.connector_id, w.kind, w.title, w.chart_type, w.color,
              w.x_key, w.y_key, w.aggregation, w.filter_column, w.layout,
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
      filterColumn: w.filter_column,
      layout: parseLayout(w.layout),
    }));

    res.json({ ...dashboard, widgets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar dashboard: nombre, favorito y/o tags (cualquier combinacion)
router.put("/:id", async (req: Request, res: Response) => {
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
    values.push(req.params.id, DEMO_USER_ID);
    const [result]: any = await pool.query(
      `UPDATE dashboards SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
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

// Eliminar dashboard
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      "DELETE FROM dashboards WHERE id = ? AND user_id = ?",
      [req.params.id, DEMO_USER_ID]
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
router.post("/:id/widgets", async (req: Request, res: Response) => {
  const {
    connectorId,
    title,
    kind = "chart",
    chartType = "bar",
    color = "primary",
    xKey,
    yKey,
    aggregation,
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
    if (!(await assertDashboardOwnership(req.params.id))) {
      return res.status(404).json({ error: "Dashboard no encontrado" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO dashboard_widgets
        (dashboard_id, connector_id, kind, title, chart_type, color, x_key, y_key, aggregation, filter_column, layout)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
router.put("/:id/widgets/:widgetId", async (req: Request, res: Response) => {
  const {
    title,
    chartType,
    color,
    xKey,
    yKey,
    aggregation,
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
    if (!(await assertDashboardOwnership(req.params.id))) {
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
router.put("/:id/layout", async (req: Request, res: Response) => {
  const items: { id: number; x: number; y: number; w: number; h: number }[] =
    req.body?.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Campo requerido: items[]" });
  }

  try {
    if (!(await assertDashboardOwnership(req.params.id))) {
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
router.delete("/:id/widgets/:widgetId", async (req: Request, res: Response) => {
  try {
    if (!(await assertDashboardOwnership(req.params.id))) {
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

export default router;
