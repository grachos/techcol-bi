/**
 * Agregacion del lado del servidor: reusa EL MISMO motor semantico del cliente
 * (client/src/lib/semantic-layer, importado por referencia via tsconfig) para
 * que los numeros sean identicos byte a byte. En vez de mandar 36k filas crudas
 * al navegador y agregar alli, el servidor -- que ya tiene las filas en cache --
 * agrega y devuelve solo el resultado (unos KB).
 *
 * Fase 1: solo widgets 'stat'. La tabla dinamica (tree_grid) y el resto migran
 * despues (ver plan). Los widgets no migrados siguen bajando filas crudas.
 */
import { SemanticModel } from "../../../client/src/lib/semantic-layer/semantic-model";
import { InMemoryMetricsRepository } from "../../../client/src/lib/semantic-layer/repository";
import { registerInferredFields } from "../../../client/src/lib/semantic-layer/infer-base-model";
import {
  buildAggregationTree,
  buildRegistryFromModel,
} from "../../../client/src/lib/semantic-layer/tree-engine";
import {
  evaluateMetricForRows,
  evaluateMetricValueForRows,
} from "../../../client/src/lib/semantic-layer/query-engine";
import type { AggregationNode } from "../../../client/src/lib/semantic-layer/tree-engine";
import { applyFormat } from "../../../client/src/lib/semantic-layer/formatting";
import type {
  FormatSpec,
  Measure,
  Row,
} from "../../../client/src/lib/semantic-layer/types";
import {
  applyFilters,
  type ActiveFilters,
} from "../../../client/src/lib/widget-filters";

type Aggregation = "sum" | "avg" | "count" | "min" | "max";

/** Spec que el widget stat manda al servidor para pedir su valor agregado. */
export interface StatQuery {
  yKey: string | null;
  aggregation?: Aggregation;
  /** primer segmento de xKey: eje X para desglosar (ej. "mes"); null = sin desglose */
  breakdownKey?: string | null;
  /** segundo segmento de xKey: grano hoja para metricas de nivel hoja */
  granoKey?: string | null;
}

export interface StatBreakdownPoint {
  label: string;
  value: number;
  formatted: string | null;
}

export interface StatResult {
  value: number | null;
  /** solo para metricas calculadas (el cliente formatea las crudas con Intl) */
  formatted: string | null;
  points: StatBreakdownPoint[] | null;
  rowCount: number;
  totalRowCount: number;
  /** serie decorativa para el sparkline de metricas crudas, submuestreada */
  spark: number[];
  /** formato de la medida (para que el cliente formatee meta/ejes sin el modelo) */
  format: FormatSpec | null;
  /** true si yKey es una medida calculada (afecta la etiqueta que muestra el cliente) */
  isCalculated: boolean;
}

const SPARK_MAX = 200;

function aggregateRaw(rows: Row[], key: string, aggregation: Aggregation): number {
  if (aggregation === "count") return rows.length;
  const values = rows.map((r) => Number(r[key])).filter((n) => !isNaN(n));
  if (values.length === 0) return 0;
  switch (aggregation) {
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * Reconstruye el SemanticModel igual que el cliente (getConnectorSemanticModel):
 * el repositorio siembra las medidas calculadas ANTES de inferir las base, sin
 * validarlas -- mismo orden que localStorage en el navegador -- y luego se
 * agregan dimensiones/medidas base inferidas de las filas.
 */
function buildModel(rows: Row[], calculatedMeasures: Measure[]): SemanticModel {
  const repo = new InMemoryMetricsRepository();
  repo.save(calculatedMeasures);
  const model = new SemanticModel({ repository: repo });
  registerInferredFields(model, rows);
  return model;
}

/**
 * Agrega columnas virtuales para las medidas calculadas ESCALARES (por fila,
 * ej. "mes" = MONTH(fecha), "ruta" = CONCAT(origen,destino)), para que agrupar
 * por su nombre funcione igual que con una columna real. Espejo exacto de
 * augmentRowsWithScalarMeasures del cliente.
 */
function augmentScalar(model: SemanticModel, rows: Row[]): Row[] {
  const engine = model.getExpressionEngine();
  const names = model
    .listMeasures()
    .filter((m) => m.isCalculated && engine.isRowScalar(m.expression))
    .map((m) => m.name);
  if (names.length === 0) return rows;

  return rows.map((row) => {
    const extra: Row = {};
    for (const name of names) {
      extra[name] = evaluateMetricValueForRows(model, [row], name);
    }
    return { ...row, ...extra };
  });
}

function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const step = values.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(values[Math.floor(i * step)]);
  return out;
}

/**
 * Reproduce el pipeline del stat-widget del cliente (augment -> filter ->
 * arbol/agregado) del lado del servidor. Devuelve solo el resultado, no las
 * filas.
 */
export function aggregateStat(
  rawRows: Row[],
  calculatedMeasures: Measure[],
  activeFilters: ActiveFilters,
  query: StatQuery
): StatResult {
  const model = buildModel(rawRows, calculatedMeasures);
  const augmented = augmentScalar(model, rawRows);
  const filtered = applyFilters(augmented, activeFilters);

  const registry = buildRegistryFromModel(model, query.yKey ? [query.yKey] : undefined);
  const measureDef = query.yKey ? registry.get(query.yKey) : undefined;
  const isCalculated =
    measureDef?.kind === "leaf" || measureDef?.kind === "derived";

  const base = {
    rowCount: filtered.length,
    totalRowCount: augmented.length,
    spark: [] as number[],
    format: measureDef?.format ?? null,
    isCalculated: !!isCalculated,
  };

  // Metrica calculada (leaf/derived): se evalua via arbol jerarquico, igual
  // que el cliente, respetando su treeKind.
  if (isCalculated && query.yKey) {
    const yKey = query.yKey;
    const groupByPath = [query.breakdownKey, query.granoKey].filter(
      (c): c is string => !!c
    );
    const tree = buildAggregationTree(filtered, groupByPath, registry);

    if (query.breakdownKey) {
      const breakdownKey = query.breakdownKey;
      const points: StatBreakdownPoint[] = tree.children
        .map((child) => ({
          label: String(child.dimensionValues[breakdownKey] ?? ""),
          value: Number(child.metrics[yKey] ?? 0),
          formatted: child.formatted[yKey] ?? null,
        }))
        .sort((a, b) => {
          const av = Number(a.label);
          const bv = Number(b.label);
          if (!Number.isNaN(av) && !Number.isNaN(bv)) return av - bv;
          return a.label.localeCompare(b.label);
        });
      const last = points[points.length - 1];
      return {
        ...base,
        value: last?.value ?? 0,
        formatted: last?.formatted ?? null,
        points,
      };
    }

    return {
      ...base,
      value: Number(tree.metrics[yKey] ?? 0),
      formatted: tree.formatted[yKey] ?? null,
      points: null,
    };
  }

  // Metrica cruda (columna base): agregado simple, sin formato (el cliente lo
  // formatea con Intl). Se incluye el sparkline submuestreado.
  const aggregation = query.aggregation ?? "sum";
  if (!query.yKey && aggregation !== "count") {
    return { ...base, value: null, formatted: null, points: null };
  }
  const value = aggregateRaw(filtered, query.yKey ?? "", aggregation);
  const spark = query.yKey
    ? downsample(
        filtered
          .map((r) => Number(r[query.yKey as string]))
          .filter((n) => !isNaN(n)),
        SPARK_MAX
      )
    : [];
  return { ...base, value, formatted: null, points: null, spark };
}

// ─────────────────────────────────────────────────────────────────────────
// Modo arbol (tree_grid / Tabla dinamica)
// ─────────────────────────────────────────────────────────────────────────

export interface TreeQuery {
  /** columnas de agrupacion, en orden (ej. ["tipo_operacion","cliente","manifiesto"]) */
  groupByColumns: string[];
  /** columnas de valor a mostrar (medidas base o calculadas) */
  valueColumns: string[];
}

export interface TreeNodeDTO {
  key: string;
  depth: number;
  dimensionValues: Record<string, unknown>;
  metrics: Record<string, unknown>;
  formatted: Record<string, string>;
  rowCount: number;
  isLeaf: boolean;
  children: TreeNodeDTO[];
}

export interface TreeColumnMeta {
  id: string;
  header: string;
  type: "number" | "percent" | "currency";
  decimals?: number;
  currency?: string;
}

export interface TreeResult {
  /** arbol de agregacion pre-calculado (metricas por nodo, sin filas crudas) */
  root: TreeNodeDTO;
  /** filas hoja proyectadas: solo las columnas necesarias (no las 68 crudas) */
  leaves: Row[];
  groupByColumns: string[];
  valueColumns: string[];
  columnsMeta: TreeColumnMeta[];
  totalRowCount: number;
}

/** Serializa el arbol quitando las filas crudas y dejando solo las metricas pedidas. */
function serializeNode(
  node: AggregationNode,
  valueColumns: string[]
): TreeNodeDTO {
  const metrics: Record<string, unknown> = {};
  const formatted: Record<string, string> = {};
  for (const col of valueColumns) {
    if (col in node.metrics) metrics[col] = node.metrics[col];
    if (col in node.formatted) formatted[col] = node.formatted[col];
  }
  return {
    key: node.key,
    depth: node.depth,
    dimensionValues: node.dimensionValues,
    metrics,
    formatted,
    rowCount: node.rowCount,
    isLeaf: node.isLeaf,
    children: node.children.map((c) => serializeNode(c, valueColumns)),
  };
}

/**
 * Agrega para un widget tree_grid: construye el arbol jerarquico en el servidor
 * (la parte pesada que congelaba el navegador) y devuelve el arbol + filas hoja
 * PROYECTADAS (solo las columnas de grupo y de valor, no las 68 crudas). El
 * cliente solo reagrupa las hojas para mostrar/virtualizar, sin recalcular
 * formulas ni bajar 69MB.
 */
export function aggregateTree(
  rawRows: Row[],
  calculatedMeasures: Measure[],
  activeFilters: ActiveFilters,
  query: TreeQuery
): TreeResult {
  const model = buildModel(rawRows, calculatedMeasures);
  const augmented = augmentScalar(model, rawRows);
  const filtered = applyFilters(augmented, activeFilters);

  // Descarta columnas que ya no existen (metrica borrada, etc.), igual que el
  // cliente hacia con availableColumnNames.
  const available = new Set(filtered[0] ? Object.keys(filtered[0]) : []);
  model.listMeasures().forEach((m) => available.add(m.name));
  const groupByColumns = query.groupByColumns.filter((c) => available.has(c));
  const valueColumns = query.valueColumns.filter((c) => available.has(c));

  const registry = buildRegistryFromModel(model, valueColumns);
  const tree = buildAggregationTree(filtered, groupByColumns, registry);

  // Filas hoja proyectadas: por cada fila cruda, las columnas de grupo + el
  // valor por-fila de cada columna de valor (mismo evaluateMetricForRows que
  // usaba el accessor de hoja del cliente, para que las hojas se vean igual).
  const leaves: Row[] = filtered.map((row) => {
    const leaf: Row = {};
    for (const col of groupByColumns) leaf[col] = row[col];
    for (const col of valueColumns) {
      leaf[col] = registry.has(col)
        ? evaluateMetricForRows(model, [row], col)
        : row[col];
    }
    return leaf;
  });

  const columnsMeta: TreeColumnMeta[] = valueColumns.map((col) => {
    const def = registry.get(col);
    const formatType = def?.format?.type;
    return {
      id: col,
      header: def?.label ?? col,
      type:
        formatType === "percent" || formatType === "currency"
          ? formatType
          : "number",
      decimals: def?.format?.decimals,
      currency: def?.format?.currency,
    };
  });

  return {
    root: serializeNode(tree, valueColumns),
    leaves,
    groupByColumns,
    valueColumns,
    columnsMeta,
    totalRowCount: filtered.length,
  };
}

/** Reexport para las rutas: formatea un valor con el mismo motor del cliente. */
export { applyFormat };
