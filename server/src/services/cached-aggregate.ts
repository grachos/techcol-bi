/**
 * Punto unico que llaman las rutas /aggregate: reusa un resultado ya
 * calculado si nada cambio (mismo conector+modo+consulta+filtros+medidas
 * calculadas, y los datos sincronizados siguen en la misma version), si no
 * corre el pipeline de siempre (rows-source + aggregation-service) y guarda
 * el resultado. Solo se cachea para conectores YA SINCRONIZADOS: los que
 * siguen en fetch en vivo ya tienen su propio TTL de 60s en connector-cache,
 * mezclar los dos modelos de vigencia seria confuso y podria servir datos
 * viejos despues de que ese TTL expira sin que aca nos enteremos.
 */
import { getRowsForAggregation, type ConnectorConfigRow } from "./rows-source";
import {
  aggregateStat,
  aggregateTree,
  type StatQuery,
  type StatResult,
  type TreeQuery,
} from "./aggregation-service";
import {
  tableExists,
  getFactColumns,
  queryRawStat,
  type RawAggregation,
} from "./analytics-db";
import { buildWhereClause } from "./filter-sql";
import { getDataVersion } from "./data-version";
import { getCachedAggregate, setCachedAggregate } from "./aggregate-cache";
import type { RuntimeParams } from "../connectors/BaseConnector";
import type { ActiveFilters } from "../../../client/src/lib/widget-filters";
import type { Measure } from "../../../client/src/lib/semantic-layer/types";

import { pool } from "../db";

/**
 * Camino rapido para un stat CRUDO (columna real, sin desglose ni formula):
 * agrega en DuckDB (SUM/AVG/COUNT/MIN/MAX nativo) en vez de bajar todas las
 * filas a JS y recorrerlas. Devuelve null -- y se cae al pipeline de siempre --
 * en cuanto algo lo hace inseguro:
 *  - el conector no esta sincronizado (no hay tabla DuckDB),
 *  - hay desglose (breakdown/grano): eso arma un arbol, no un escalar,
 *  - la medida es calculada (leaf/derived) o no es una columna real,
 *  - algun filtro activo apunta a una columna que NO existe en la tabla (seria
 *    una dimension calculada tipo "mes" que solo el camino JS sabe aplicar;
 *    empujar a SQL la ignoraria y daria un numero equivocado).
 * Cuando devuelve null el resultado es identico al de antes: es puro atajo.
 */
async function tryFastRawStat(
  connector: ConnectorConfigRow,
  activeFilters: ActiveFilters,
  query: StatQuery,
  calculatedMeasures: Measure[]
): Promise<StatResult | null> {
  if (query.breakdownKey || query.granoKey) return null;

  const aggregation: RawAggregation = query.aggregation ?? "sum";
  // Igual que el camino JS: sin yKey solo tiene sentido COUNT.
  if (!query.yKey && aggregation !== "count") {
    return {
      value: null,
      formatted: null,
      points: null,
      rowCount: 0,
      totalRowCount: 0,
      spark: [],
      format: null,
      isCalculated: false,
    };
  }

  const columns = await getFactColumns(connector.id);

  // La medida tiene que ser una columna real y NO una medida calculada del
  // usuario (esas van por el arbol jerarquico, no por un agregado plano).
  if (query.yKey) {
    if (!columns.has(query.yKey)) return null;
    if (calculatedMeasures.some((m) => m.name === query.yKey)) return null;
  }

  // Todos los filtros activos deben ser columnas reales (ver doc de arriba).
  for (const key of Object.keys(activeFilters ?? {})) {
    if (!columns.has(key)) return null;
  }

  const { sql, values } = buildWhereClause(activeFilters, columns);
  const raw = await queryRawStat(
    connector.id,
    query.yKey ?? null,
    aggregation,
    sql,
    values
  );

  return {
    value: raw.value,
    formatted: null,
    points: null,
    rowCount: raw.rowCount,
    totalRowCount: raw.totalRowCount,
    spark: raw.spark,
    format: null,
    isCalculated: false,
  };
}

export async function runAggregateCached(
  connector: ConnectorConfigRow,
  params: RuntimeParams,
  activeFilters: ActiveFilters,
  mode: "stat" | "tree",
  query: StatQuery | TreeQuery,
  calculatedMeasures: Measure[]
) {
  // Si no se pasaron medidas calculadas en el request, se buscan en la BD del conector
  let effectiveMeasures = calculatedMeasures;
  if (!effectiveMeasures || effectiveMeasures.length === 0) {
    try {
      const [dbRows]: any = await pool.query(
        "SELECT calculated_measures FROM connectors WHERE id = ?",
        [connector.id]
      );
      if (dbRows[0]?.calculated_measures) {
        const raw = dbRows[0].calculated_measures;
        effectiveMeasures = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (e) {
      console.error("Error loading calculated_measures from DB:", e);
    }
  }

  const synced = await tableExists(connector.id);

  const compute = async () => {
    // Atajo: stat crudo sobre un conector sincronizado -> agrega en DuckDB sin
    // materializar las filas en JS. Si no aplica, sigue el pipeline de siempre.
    if (mode === "stat" && synced) {
      const fast = await tryFastRawStat(
        connector,
        activeFilters,
        query as StatQuery,
        effectiveMeasures
      );
      if (fast) return fast;
    }

    const { rows } = await getRowsForAggregation(connector, params, activeFilters, {
      mode,
      query,
      calculatedMeasures: effectiveMeasures,
    });
    return mode === "tree"
      ? aggregateTree(rows, effectiveMeasures, activeFilters, query as TreeQuery)
      : aggregateStat(rows, effectiveMeasures, activeFilters, query as StatQuery);
  };

  if (!synced) return compute();

  const key = JSON.stringify([
    connector.id,
    await getDataVersion(connector.id),
    mode,
    query,
    activeFilters,
    calculatedMeasures,
  ]);
  const cached = getCachedAggregate(key);
  if (cached !== undefined) return cached;

  const result = await compute();
  setCachedAggregate(key, result);
  return result;
}
