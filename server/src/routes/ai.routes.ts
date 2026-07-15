import { Router, Request, Response } from "express";
import { pool } from "../db";
import { decryptConfig, EncryptedPayload } from "../utils/encryption";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { ConnectorType } from "../connectors/BaseConnector";
import { askGroqJson } from "../services/groq";

const router = Router();

// TODO: reemplazar por el usuario autenticado cuando exista auth real
const DEMO_USER_ID = 1;

const CHART_TYPES = ["bar", "line", "area", "pie", "table"] as const;
type ChartType = (typeof CHART_TYPES)[number];

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

interface ConnectorRow {
  id: number;
  name: string;
  type: ConnectorType;
  config: string | EncryptedPayload;
}

function parseStoredConfig(raw: string | EncryptedPayload): EncryptedPayload {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

interface ConnectorSummary {
  id: number;
  name: string;
  type: ConnectorType;
  columns: string[];
  sampleRow: Record<string, unknown> | null;
}

async function describeConnector(
  connectorId: number
): Promise<ConnectorSummary | null> {
  const [rows]: any = await pool.query(
    "SELECT id, name, type, config FROM connectors WHERE id = ? AND user_id = ?",
    [connectorId, DEMO_USER_ID]
  );
  const row: ConnectorRow | undefined = rows[0];
  if (!row) return null;

  try {
    const config = decryptConfig(parseStoredConfig(row.config));
    const instance = ConnectorFactory.create(row.type, config);
    const data = await instance.fetchData();
    const firstRow = Array.isArray(data)
      ? data.find((d) => typeof d === "object" && d !== null)
      : null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      columns: firstRow ? Object.keys(firstRow) : [],
      sampleRow: firstRow ?? null,
    };
  } catch {
    return { id: row.id, name: row.name, type: row.type, columns: [], sampleRow: null };
  }
}

async function describeConnectors(): Promise<ConnectorSummary[]> {
  const [rows]: any = await pool.query(
    "SELECT id, name, type, config FROM connectors WHERE user_id = ?",
    [DEMO_USER_ID]
  );

  const summaries = await Promise.all(
    (rows as ConnectorRow[]).map(async (row): Promise<ConnectorSummary> => {
      try {
        const config = decryptConfig(parseStoredConfig(row.config));
        const instance = ConnectorFactory.create(row.type, config);
        const data = await instance.fetchData();
        const firstRow = Array.isArray(data)
          ? data.find((d) => typeof d === "object" && d !== null)
          : null;
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          columns: firstRow ? Object.keys(firstRow) : [],
          sampleRow: firstRow ?? null,
        };
      } catch {
        // Si el conector falla al leer, se ofrece igual pero sin columnas conocidas
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          columns: [],
          sampleRow: null,
        };
      }
    })
  );

  return summaries;
}

function buildSystemPrompt(connectors: ConnectorSummary[]): string {
  const catalog = connectors
    .map((c) => {
      const cols = c.columns.length > 0 ? c.columns.join(", ") : "(desconocidas)";
      return `- id=${c.id} nombre="${c.name}" tipo=${c.type} columnas=[${cols}]`;
    })
    .join("\n");

  return `Eres un asistente que configura widgets para un dashboard de Business Intelligence.
El usuario describe en lenguaje natural (espanol o ingles) que quiere visualizar.
Debes elegir el conector de datos mas adecuado de esta lista y la mejor configuracion de grafica.

Conectores disponibles:
${catalog || "(el usuario no tiene conectores configurados)"}

Tipos de grafica validos: bar, line, area, pie, table.
Colores validos: primary, pink, blue, green, orange, purple, teal.

Responde SOLO un objeto JSON con esta forma exacta, sin texto adicional:
{
  "connectorId": <numero, uno de los ids listados arriba>,
  "title": "<titulo corto y descriptivo para el widget>",
  "chartType": "<bar|line|area|pie|table>",
  "color": "<primary|pink|blue|green|orange|purple|teal, elige uno acorde al tema o pedido>",
  "xKey": "<nombre de columna para el eje X/categoria, o null si no aplica o quieres autodeteccion>",
  "yKey": "<nombre de columna numerica para el eje Y, o null si no aplica o quieres autodeteccion>",
  "explanation": "<una frase breve explicando tu eleccion>"
}

Si el usuario menciona un color (ej. "en azul", "verde"), usalo; si no, usa "primary".
Si no hay conectores disponibles, responde con connectorId: null y explica el problema en "explanation".
Usa unicamente columnas que existan en el conector elegido. Si no estas seguro de las columnas, deja xKey/yKey en null.`;
}

// Generar una sugerencia de widget a partir de una descripcion en lenguaje natural
router.post("/suggest-widget", async (req: Request, res: Response) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Campo requerido: prompt" });
  }

  try {
    const connectors = await describeConnectors();
    if (connectors.length === 0) {
      return res.status(400).json({
        error: "No tienes conectores configurados todavia. Crea uno primero.",
      });
    }

    const systemPrompt = buildSystemPrompt(connectors);
    const result: any = await askGroqJson(systemPrompt, prompt);

    const connectorId = Number(result?.connectorId);
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) {
      return res.status(422).json({
        error:
          result?.explanation ??
          "La IA no pudo elegir un conector valido para tu descripcion.",
      });
    }

    const chartType: ChartType = CHART_TYPES.includes(result?.chartType)
      ? result.chartType
      : "bar";

    const color: WidgetColor = WIDGET_COLORS.includes(result?.color)
      ? result.color
      : "primary";

    const xKey =
      typeof result?.xKey === "string" && connector.columns.includes(result.xKey)
        ? result.xKey
        : null;
    const yKey =
      typeof result?.yKey === "string" && connector.columns.includes(result.yKey)
        ? result.yKey
        : null;

    res.json({
      connectorId: connector.id,
      connectorName: connector.name,
      title:
        typeof result?.title === "string" && result.title.trim()
          ? result.title.trim()
          : prompt.slice(0, 60),
      chartType,
      color,
      xKey,
      yKey,
      explanation: typeof result?.explanation === "string" ? result.explanation : "",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const COLORABLE_KINDS = ["chart", "stat", "combo", "progress", "map"];

const WIDGET_KIND_DESCRIPTIONS: Record<string, string> = {
  chart:
    'Grafica de datos. Campos editables: "title", "chartType" (bar|line|area|pie|table), "color", "xKey" (columna del eje X o categoria), "yKey" (columna numerica).',
  stat:
    'Tarjeta KPI (un numero agregado). Campos editables: "title", "color", "yKey" (columna a agregar), "aggregation" (sum|avg|count|min|max).',
  combo:
    'Grafica combinada (barras + linea). Campos editables: "title", "color", "xKey" (categoria), "yKey" (columna numerica de las barras).',
  progress:
    'Lista de barras de progreso. Campos editables: "title", "color", "xKey" (columna de etiqueta), "yKey" (columna numerica del valor).',
  map:
    'Mapa geografico coloreado por region. Campos editables: "title", "color", "xKey" (columna con nombre de pais), "yKey" (columna numerica del valor).',
  calendar:
    'Calendario. Campos editables: "title", "xKey" (columna de fecha a resaltar, o null).',
  clock: 'Reloj en vivo, sin datos. Campo editable: "title".',
  filter_date:
    'Filtro de rango de fechas que afecta a otros widgets. Campos editables: "title", "filterColumn" (columna a filtrar).',
  filter_select:
    'Filtro de seleccion que afecta a otros widgets. Campos editables: "title", "filterColumn" (columna a filtrar).',
};

function buildEditSystemPrompt(
  widget: any,
  connector: ConnectorSummary | null
): string {
  const cols = connector && connector.columns.length > 0
    ? connector.columns.join(", ")
    : "(desconocidas o sin conector)";

  return `Eres un asistente que edita un widget existente de un dashboard de Business Intelligence.
El usuario describe en lenguaje natural (espanol o ingles) que quiere cambiar.

Widget actual:
- tipo: ${widget.kind}
- titulo: "${widget.title}"
- chartType: ${widget.chart_type}
- color: ${widget.color}
- xKey: ${widget.x_key ?? "null"}
- yKey: ${widget.y_key ?? "null"}
- aggregation: ${widget.aggregation ?? "null"}
- filterColumn: ${widget.filter_column ?? "null"}
- conector: ${connector?.name ?? "(ninguno)"} | columnas disponibles: [${cols}]

${WIDGET_KIND_DESCRIPTIONS[widget.kind] ?? ""}

Colores validos: primary, pink, blue, green, orange, purple, teal.
No puedes cambiar el tipo de widget ni el conector; solo sus campos editables.

Responde SOLO un objeto JSON con los campos que quieras cambiar (omite los que no cambian):
{
  "title": "<nuevo titulo, opcional>",
  "chartType": "<bar|line|area|pie|table, opcional>",
  "color": "<primary|pink|blue|green|orange|purple|teal, opcional>",
  "xKey": "<nombre de columna, o null, opcional>",
  "yKey": "<nombre de columna, o null, opcional>",
  "aggregation": "<sum|avg|count|min|max, opcional>",
  "filterColumn": "<nombre de columna, opcional>",
  "explanation": "<una frase breve explicando el cambio>"
}
Usa unicamente columnas de la lista disponible. Si la instruccion no aplica a este tipo de widget, dejalo sin cambios y explica por que en "explanation".`;
}

// Editar un widget existente a partir de una instruccion en lenguaje natural
router.post("/edit-widget", async (req: Request, res: Response) => {
  const { dashboardId, widgetId, prompt } = req.body ?? {};
  if (!dashboardId || !widgetId || !prompt || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Campos requeridos: dashboardId, widgetId, prompt",
    });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT w.* FROM dashboard_widgets w
       JOIN dashboards d ON d.id = w.dashboard_id
       WHERE w.id = ? AND w.dashboard_id = ? AND d.user_id = ?`,
      [widgetId, dashboardId, DEMO_USER_ID]
    );
    const widget = rows[0];
    if (!widget) {
      return res.status(404).json({ error: "Widget no encontrado" });
    }

    const connector = widget.connector_id
      ? await describeConnector(widget.connector_id)
      : null;

    const systemPrompt = buildEditSystemPrompt(widget, connector);
    const result: any = await askGroqJson(systemPrompt, prompt);

    const KINDS_WITH_XKEY = ["chart", "combo", "progress", "map", "calendar"];
    const KINDS_WITH_YKEY = ["chart", "combo", "progress", "map", "stat"];

    const patch: Record<string, unknown> = {};
    if (typeof result?.title === "string" && result.title.trim()) {
      patch.title = result.title.trim();
    }
    if (widget.kind === "chart" && CHART_TYPES.includes(result?.chartType)) {
      patch.chartType = result.chartType;
    }
    if (
      COLORABLE_KINDS.includes(widget.kind) &&
      WIDGET_COLORS.includes(result?.color)
    ) {
      patch.color = result.color;
    }
    const columns = connector?.columns ?? [];
    if (
      KINDS_WITH_XKEY.includes(widget.kind) &&
      (result?.xKey === null ||
        (typeof result?.xKey === "string" && columns.includes(result.xKey)))
    ) {
      patch.xKey = result.xKey;
    }
    if (
      KINDS_WITH_YKEY.includes(widget.kind) &&
      (result?.yKey === null ||
        (typeof result?.yKey === "string" && columns.includes(result.yKey)))
    ) {
      patch.yKey = result.yKey;
    }
    if (widget.kind === "stat" && AGGREGATIONS.includes(result?.aggregation)) {
      patch.aggregation = result.aggregation;
    }
    if (
      (widget.kind === "filter_date" || widget.kind === "filter_select") &&
      typeof result?.filterColumn === "string" &&
      columns.includes(result.filterColumn)
    ) {
      patch.filterColumn = result.filterColumn;
    }

    res.json({
      patch,
      explanation: typeof result?.explanation === "string" ? result.explanation : "",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generar SQL query desde descripción en lenguaje natural
router.post("/generate-sql", async (req: Request, res: Response) => {
  const { prompt, sampleColumns, connectorType } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Campo requerido: prompt" });
  }
  if (
    !connectorType ||
    (connectorType !== "mysql" && connectorType !== "postgresql")
  ) {
    return res
      .status(400)
      .json({ error: 'connectorType debe ser "mysql" o "postgresql"' });
  }

  const columns = Array.isArray(sampleColumns) ? sampleColumns : [];

  const systemPrompt = `Eres un experto en SQL ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}.
El usuario describe en lenguaje natural qué datos quiere, y tu tarea es generar una query SELECT SQL válida.

${
  columns.length > 0
    ? `Columnas disponibles: ${columns.join(", ")}`
    : "No hay información de columnas, pero intenta generar un query razonable basado en la descripción."
}

Reglas:
- SOLO genera SELECT (nunca INSERT, UPDATE, DELETE, DROP, etc.)
- La query debe ser sintácticamente correcta en ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}
- Si no puedes generar un query válido, devuelve un query simple "SELECT 1 AS resultado" con una explicación del problema
- La query debe ser corta y eficiente

Responde SOLO con un objeto JSON:
{
  "query": "SELECT ... FROM ...",
  "explanation": "breve explicación de lo que hace el query"
}`;

  try {
    const result: any = await askGroqJson(systemPrompt, prompt);
    const query =
      typeof result?.query === "string"
        ? result.query.trim()
        : "SELECT 1 AS resultado";
    const explanation =
      typeof result?.explanation === "string"
        ? result.explanation
        : "Query generado por IA";

    res.json({ query, explanation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
