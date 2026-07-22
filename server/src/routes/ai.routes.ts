import { Router, Request, Response } from "express";
import { serverError } from "../utils/http-error";
import { pool } from "../db";
import { decryptConfig, EncryptedPayload } from "../utils/encryption";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { ConnectorType } from "../connectors/BaseConnector";
import { MySQLConnector } from "../connectors/MySQL";
import { PostgreSQLConnector } from "../connectors/PostgreSQL";
import { askGroqJson } from "../services/groq";

const router = Router();

const WIDGET_KINDS = [
  "chart",
  "stat",
  "combo",
  "progress",
  "map",
  "tree_grid",
  "calendar",
  "clock",
  "filter_date",
  "filter_select",
] as const;
type WidgetKind = (typeof WIDGET_KINDS)[number];

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
  connectorId: number,
  userId: number
): Promise<ConnectorSummary | null> {
  const [rows]: any = await pool.query(
    "SELECT id, name, type, config FROM connectors WHERE id = ? AND user_id = ?",
    [connectorId, userId]
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

async function describeConnectors(userId: number): Promise<ConnectorSummary[]> {
  const [rows]: any = await pool.query(
    "SELECT id, name, type, config FROM connectors WHERE user_id = ?",
    [userId]
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

function buildSystemPrompt(
  connectors: ConnectorSummary[],
  calculatedMeasures?: Array<{ name: string; label: string; expression?: string; connectorId?: number; connectorName?: string }>
): string {
  const catalog = connectors
    .map((c) => {
      const cols = c.columns.length > 0 ? c.columns.join(", ") : "(desconocidas)";
      const cMeasures = (calculatedMeasures ?? [])
        .filter((m) => m.connectorId === c.id || !m.connectorId)
        .map((m) => `${m.name} ("${m.label}"${m.expression ? `: ${m.expression}` : ''})`);
      const measuresText = cMeasures.length > 0 ? cMeasures.join(", ") : "ninguna";
      return `- id=${c.id} nombre="${c.name}" tipo=${c.type}\n  Columnas crudas: [${cols}]\n  Métricas calculadas: [${measuresText}]`;
    })
    .join("\n\n");

  return `Eres un experto copiloto de Business Intelligence y asistente de creación de widgets.
El usuario describe en lenguaje natural qué widget o visualización desea crear.
Debes analizar la intención del usuario y seleccionar EL MEJOR TIPO DE WIDGET ("kind"), el conector adecuado y los campos correspondientes.

Conectores y catálogo de datos disponible (incluye columnas crudas y métricas calculadas):
${catalog || "(el usuario no tiene conectores configurados)"}

Tipos de widget disponibles (propiedad "kind"):
1. "filter_select": Filtro de selección / desplegable para filtrar el dashboard por una columna (ej: "filtro de seleccion", "filtro de cliente", "desplegable", "dropdown", "filtro"). Requiere "filterColumn".
2. "filter_date": Filtro de rango de fechas (ej: "filtro de fechas", "rango de fecha"). Requiere "filterColumn".
3. "stat": Tarjeta KPI con un valor numérico destacado o agregado (ej: "KPI de utilidad", "total de ventas", "indicador"). Usar "yKey" y opcionalmente "aggregation" ("sum"|"avg"|"count"|"min"|"max").
4. "tree_grid": Tabla analítica jerárquica / tabla dinámica (ej: "tabla dinamica", "matriz de datos", "tabla de clientes con total remesa"). Usar "xKey" (columnas para agrupar separadas por coma) e "yKey" (columnas numéricas o métricas separadas por coma).
5. "chart": Gráfica tradicional (barras, líneas, área, pastel, tabla simple). Usar "chartType" ("bar"|"line"|"area"|"pie"|"table"), "xKey" (categoría/eje X) e "yKey" (valor/eje Y).
6. "progress": Lista de barras de progreso (ej: "progreso", "porcentaje por categoría"). Usar "xKey" e "yKey".
7. "map": Mapa geográfico coloreado por país/región. Usar "xKey" (país) e "yKey" (valor).
8. "combo": Gráfica combinada de barras y líneas. Usar "xKey" e "yKey".
9. "calendar": Calendario de fechas. Usar "xKey" (columna de fecha).
10. "clock": Reloj en vivo.

Colores válidos: primary, pink, blue, green, orange, purple, teal.

REGLAS CRÍTICAS DE SELECCIÓN:
- Si el usuario pide un filtro de selección (palabras clave: "filtro de seleccion", "filtro", "desplegable", "dropdown", "select", "filtrar por"), DEBES responder con "kind": "filter_select" y asignar "filterColumn" con el nombre de la columna adecuada. NUNCA respondas "chart" ni "table" si el usuario pidió un filtro.
- Si el usuario pide un filtro de fecha, DEBES responder con "kind": "filter_date" y "filterColumn" asignado.
- Si pide un KPI o total acumulado, responde con "kind": "stat".
- Si pide una tabla dinámica, matriz o jerarquía con totales, responde con "kind": "tree_grid".
- Puedes usar tanto columnas crudas como métricas calculadas en xKey, yKey o filterColumn.
- Proporciona una explicación clara, amigable y profesional en español en "explanation", indicando qué tipo de widget elegiste y por qué es el ideal.

Responde ÚNICAMENTE un objeto JSON estructurado con la siguiente forma exacta:
{
  "kind": "<filter_select|filter_date|stat|tree_grid|chart|progress|map|combo|calendar|clock>",
  "connectorId": <numero_id_conector>,
  "title": "<titulo corto y descriptivo>",
  "chartType": "<bar|line|area|pie|table>",
  "color": "<primary|pink|blue|green|orange|purple|teal>",
  "xKey": "<nombre de columna o columnas separadas por coma, o null>",
  "yKey": "<nombre de columna/métrica o columnas separadas por coma, o null>",
  "filterColumn": "<nombre de columna a filtrar, o null>",
  "aggregation": "<sum|avg|count|min|max, o null>",
  "explanation": "<explicación clara en español de por qué elegiste este tipo de widget y conector>"
}`;
}

// Generar una sugerencia de widget a partir de una descripcion en lenguaje natural
router.post("/suggest-widget", async (req: Request, res: Response) => {
  const { prompt, calculatedMeasures } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Campo requerido: prompt" });
  }

  try {
    const connectors = await describeConnectors(req.userId!);
    if (connectors.length === 0) {
      return res.status(400).json({
        error: "No tienes conectores configurados todavía. Crea uno primero.",
      });
    }

    const systemPrompt = buildSystemPrompt(connectors, calculatedMeasures);
    const result: any = await askGroqJson(systemPrompt, prompt);

    const connectorId = Number(result?.connectorId);
    const connector = connectors.find((c) => c.id === connectorId) ?? connectors[0];
    if (!connector) {
      return res.status(422).json({
        error:
          result?.explanation ??
          "La IA no pudo elegir un conector válido para tu descripción.",
      });
    }

    const kind: WidgetKind = WIDGET_KINDS.includes(result?.kind)
      ? result.kind
      : "chart";

    const chartType: ChartType = CHART_TYPES.includes(result?.chartType)
      ? result.chartType
      : "bar";

    const color: WidgetColor = WIDGET_COLORS.includes(result?.color)
      ? result.color
      : "primary";

    // Colección de todos los campos válidos (columnas crudas + métricas calculadas) para el conector elegido
    const validFields = new Set<string>();
    connector.columns.forEach((c) => validFields.add(c));
    if (Array.isArray(calculatedMeasures)) {
      calculatedMeasures
        .filter((m: any) => m.connectorId === connector.id || !m.connectorId)
        .forEach((m: any) => {
          if (m.name) validFields.add(m.name);
          if (m.label) validFields.add(m.label);
        });
    }

    const matchField = (field: unknown): string | null => {
      if (typeof field !== "string" || !field.trim()) return null;
      const clean = field.trim();
      if (validFields.has(clean)) return clean;
      const lower = clean.toLowerCase();
      for (const valid of validFields) {
        if (valid.toLowerCase() === lower) return valid;
      }
      for (const valid of validFields) {
        if (valid.toLowerCase().includes(lower) || lower.includes(valid.toLowerCase())) return valid;
      }
      return clean;
    };

    const filterColumn = matchField(result?.filterColumn) ?? matchField(result?.xKey);
    const xKey = matchField(result?.xKey);
    const yKey = matchField(result?.yKey);

    res.json({
      kind,
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
      filterColumn,
      aggregation,
      explanation: typeof result?.explanation === "string" ? result.explanation : "",
    });
  } catch (error: any) {
    serverError(res, "ai", error);
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
      [widgetId, dashboardId, req.userId]
    );
    const widget = rows[0];
    if (!widget) {
      return res.status(404).json({ error: "Widget no encontrado" });
    }

    const connector = widget.connector_id
      ? await describeConnector(widget.connector_id, req.userId!)
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
    serverError(res, "ai", error);
  }
});

// Generar SQL query desde descripción en lenguaje natural
router.post("/generate-sql", async (req: Request, res: Response) => {
  const { prompt, sampleColumns, schemaDescription, connectorType } = req.body ?? {};
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
  const schema = typeof schemaDescription === "string" ? schemaDescription : "";

  const systemPrompt = `Eres un experto en SQL ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}.
El usuario describe en lenguaje natural qué datos quiere, y tu tarea es generar una query SELECT SQL válida.

${
  schema
    ? `Schema disponible (tablas y columnas):\n${schema}`
    : columns.length > 0
    ? `Columnas disponibles: ${columns.join(", ")}`
    : "No hay información de schema, pero intenta generar un query razonable basado en la descripción."
}

Reglas:
- SOLO genera SELECT (nunca INSERT, UPDATE, DELETE, DROP, etc.)
- La query debe ser sintácticamente correcta en ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}
- SOLO usa tablas y columnas que existan en el schema proporcionado
- Si el schema es proporcionado y el usuario pide columnas que no existen, ajusta la solicitud y explica el cambio
- Si no puedes generar un query válido, devuelve un query simple "SELECT 1 AS resultado" con una explicación clara
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
    serverError(res, "ai", error);
  }
});

// Obtener schema (tablas y columnas) de una base de datos
router.post("/get-schema", async (req: Request, res: Response) => {
  const { host, port, user, password, database, type } = req.body ?? {};

  if (!host || !user || !database || !type) {
    return res
      .status(400)
      .json({ error: "Campos requeridos: host, user, database, type" });
  }

  if (type !== "mysql" && type !== "postgresql") {
    return res
      .status(400)
      .json({ error: 'type debe ser "mysql" o "postgresql"' });
  }

  try {
    // Crear conector solo para introspección (con query dummy)
    let connector: any;
    if (type === "mysql") {
      connector = new MySQLConnector({
        host,
        port: port || 3306,
        user,
        password,
        database,
        query: "SELECT 1", // Dummy query, solo para pasar validación
      });
    } else {
      connector = new PostgreSQLConnector({
        host,
        port: port || 5432,
        user,
        password,
        database,
        query: "SELECT 1", // Dummy query, solo para pasar validación
      });
    }

    // Obtener schema
    const schema = await connector.getSchema?.();
    if (!schema) {
      return res
        .status(500)
        .json({ error: "No se pudo obtener el schema de la base de datos" });
    }

    res.json(schema);
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Error al conectar con la base de datos",
    });
  }
});

// Sugerir fix a una query que falla
router.post("/fix-query", async (req: Request, res: Response) => {
  const { query, error, schema, connectorType } = req.body ?? {};

  if (!query || typeof query !== "string" || !error || typeof error !== "string") {
    return res
      .status(400)
      .json({ error: "Campos requeridos: query, error" });
  }

  if (!connectorType || (connectorType !== "mysql" && connectorType !== "postgresql")) {
    return res
      .status(400)
      .json({ error: 'connectorType debe ser "mysql" o "postgresql"' });
  }

  const schemaInfo = typeof schema === "string" ? schema : "";

  const systemPrompt = `Eres un experto en SQL ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}.
El usuario tiene una consulta que falló con un error.

Tu tarea: analizar el error y sugerir una consulta corregida.

Query original:
${query}

Error:
${error}

${schemaInfo ? `Schema disponible:\n${schemaInfo}` : ""}

Reglas:
- SOLO devuelve SELECT queries (nunca INSERT, UPDATE, DELETE, etc.)
- La query debe ser sintácticamente correcta en ${connectorType === "mysql" ? "MySQL" : "PostgreSQL"}
- Si el error menciona una columna inexistente, sugiere una alternativa del schema disponible
- Si el error es por ortografía (ej: "junio" vs "June"), adapta al idioma de los datos
- Si no puedes determinar el fix, devuelve la query original con una explicación

Responde SOLO con un objeto JSON:
{
  "query": "SELECT ... corrected query ...",
  "explanation": "breve explicación de lo que se corrigió y por qué"
}`;

  try {
    const result: any = await askGroqJson(systemPrompt, "Por favor, sugiere un fix para esta query.");
    const query_fixed =
      typeof result?.query === "string" ? result.query.trim() : query;
    const explanation =
      typeof result?.explanation === "string"
        ? result.explanation
        : "Se sugirió un fix basado en el error";

    res.json({ query: query_fixed, explanation });
  } catch (error: any) {
    serverError(res, "ai", error);
  }
});

export default router;
