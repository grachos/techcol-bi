/**
 * Punto unico de donde salen las filas para agregar (stat/tree): si el
 * conector ya tiene datos sincronizados en DuckDB, se consultan de ahi con el
 * filtro empujado a SQL (sin tocar la API externa). Si todavia no se
 * sincronizo nunca, cae al camino de siempre (fetch en vivo + cache de 60s en
 * MariaDB) -- ningun conector se rompe por no haber corrido /sync todavia.
 */
import { EncryptedPayload, decryptConfig } from "../utils/encryption";
import { ConnectorFactory } from "../connectors/ConnectorFactory";
import { ConnectorType, RuntimeParams } from "../connectors/BaseConnector";
import { getCachedConnectorData } from "./connector-cache";
import { tableExists, getFactColumns, queryFactRows } from "./analytics-db";
import { buildWhereClause } from "./filter-sql";
import { resolveNeededColumns } from "./column-projection";
import type { StatQuery, TreeQuery } from "./aggregation-service";
import type { ActiveFilters } from "../../../client/src/lib/widget-filters";
import type { Row } from "../../../client/src/lib/semantic-layer/types";
import type { Measure } from "../../../client/src/lib/semantic-layer/types";

export interface ConnectorConfigRow {
  id: number;
  type: ConnectorType;
  config: string | EncryptedPayload;
  date_column?: string | null;
}

export interface SourceRowsResult {
  rows: Row[];
  source: "duckdb" | "live";
}

export interface AggregationRequestInfo {
  mode: "stat" | "tree";
  query: StatQuery | TreeQuery;
  calculatedMeasures: Measure[];
}

export async function getRowsForAggregation(
  connector: ConnectorConfigRow,
  params: RuntimeParams,
  activeFilters: ActiveFilters,
  request: AggregationRequestInfo
): Promise<SourceRowsResult> {
  if (await tableExists(connector.id)) {
    const columns = await getFactColumns(connector.id);
    const { sql, values } = buildWhereClause(activeFilters, columns);
    // Proyecta solo las columnas que la consulta realmente necesita (grupo,
    // valor, filtros, y sus dependencias si son medidas calculadas) en vez de
    // traer las 68 columnas de Silog por fila -- el costo dominante real
    // medido con el profiler de V8 (objetos de fila anchos, no el arbol).
    const neededColumns = resolveNeededColumns(
      request.mode,
      request.query,
      request.calculatedMeasures,
      activeFilters,
      columns
    );
    const rows = await queryFactRows(connector.id, sql, values, neededColumns);
    return { rows: rows as Row[], source: "duckdb" };
  }

  const payload =
    typeof connector.config === "string" ? JSON.parse(connector.config) : connector.config;
  const data = await getCachedConnectorData(connector.id, params, async () => {
    const config = decryptConfig(payload as EncryptedPayload);
    const instance = ConnectorFactory.create(connector.type, config);
    return instance.fetchData(params);
  });
  return { rows: Array.isArray(data) ? (data as Row[]) : [], source: "live" };
}

/**
 * Equivalente de getRowsForAggregation para /:id/data (filas crudas: las usan
 * los widgets de filtro para listar valores unicos, y chart/table/combo/etc.
 * que todavia no pasan por /aggregate). `params.from/to` (los mismos que
 * viajaban a la API en vivo) se traducen a un WHERE sobre `date_column` si el
 * conector lo tiene configurado y ya esta sincronizado -- si no, mismo
 * fallback de siempre.
 *
 * `wantedColumns`: opcional -- si el widget que pide los datos solo necesita
 * una o dos columnas (ej. un filtro de seleccion), las declara y se proyecta
 * en SQL en vez de traer las 68 de Silog. Si se omite, sigue siendo SELECT *
 * (varios widgets del mismo conector comparten un solo fetch via React Query
 * cuando piden exactamente los mismos parametros; proyectar distinto por
 * widget fragmentaria ese cache compartido, asi que solo tiene sentido
 * cuando el widget ya es el unico consumidor de esa combinacion).
 */
export async function getRawRowsForConnector(
  connector: ConnectorConfigRow,
  params: RuntimeParams,
  wantedColumns?: string[]
): Promise<SourceRowsResult> {
  if (await tableExists(connector.id)) {
    const columns = await getFactColumns(connector.id);
    const filters: ActiveFilters =
      connector.date_column && (params.from || params.to)
        ? {
            [connector.date_column]: {
              type: "date_range",
              from: params.from ?? null,
              to: params.to ?? null,
            },
          }
        : {};
    const { sql, values } = buildWhereClause(filters, columns);
    const projected = wantedColumns?.filter((c) => columns.has(c)) ?? null;
    const rows = await queryFactRows(connector.id, sql, values, projected);
    return { rows: rows as Row[], source: "duckdb" };
  }

  const payload =
    typeof connector.config === "string" ? JSON.parse(connector.config) : connector.config;
  const data = await getCachedConnectorData(connector.id, params, async () => {
    const config = decryptConfig(payload as EncryptedPayload);
    const instance = ConnectorFactory.create(connector.type, config);
    return instance.fetchData(params);
  });
  return { rows: Array.isArray(data) ? (data as Row[]) : [], source: "live" };
}
