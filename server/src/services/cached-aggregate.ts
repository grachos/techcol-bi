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
import { aggregateStat, aggregateTree, type StatQuery, type TreeQuery } from "./aggregation-service";
import { tableExists } from "./analytics-db";
import { getDataVersion } from "./data-version";
import { getCachedAggregate, setCachedAggregate } from "./aggregate-cache";
import type { RuntimeParams } from "../connectors/BaseConnector";
import type { ActiveFilters } from "../../../client/src/lib/widget-filters";
import type { Measure } from "../../../client/src/lib/semantic-layer/types";

export async function runAggregateCached(
  connector: ConnectorConfigRow,
  params: RuntimeParams,
  activeFilters: ActiveFilters,
  mode: "stat" | "tree",
  query: StatQuery | TreeQuery,
  calculatedMeasures: Measure[]
) {
  const synced = await tableExists(connector.id);

  const compute = async () => {
    const { rows } = await getRowsForAggregation(connector, params, activeFilters, {
      mode,
      query,
      calculatedMeasures,
    });
    return mode === "tree"
      ? aggregateTree(rows, calculatedMeasures, activeFilters, query as TreeQuery)
      : aggregateStat(rows, calculatedMeasures, activeFilters, query as StatQuery);
  };

  if (!synced) return compute();

  const key = JSON.stringify([
    connector.id,
    getDataVersion(connector.id),
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
