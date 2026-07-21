/**
 * Resuelve que columnas RAW de la fuente hacen falta para responder una
 * consulta de agregacion, para pedirle a DuckDB solo esas en vez de
 * SELECT * (68 columnas en Silog). Perfilado con el profiler de V8: los
 * objetos de fila anchos (68 props, formas variables) eran el hotspot #1
 * (KeyedStoreIC_Megamorphic) -- proyectar es la mejora de mayor impacto real,
 * no la reconstruccion del arbol en si.
 */
import { ExpressionEngine } from "../../../client/src/lib/semantic-layer/expression";
import type { Measure } from "../../../client/src/lib/semantic-layer/types";
import type { ActiveFilters } from "../../../client/src/lib/widget-filters";
import type { StatQuery, TreeQuery } from "./aggregation-service";

const engine = new ExpressionEngine();

/**
 * `names` puede mezclar columnas crudas (ej. "tipo_operacion") y nombres de
 * medidas calculadas (ej. "rentabilidad_ejemplo" = total_remesa/registros):
 * para cada una que coincide con una medida calculada, se resuelve
 * recursivamente su formula hasta llegar a columnas/medidas que NO son
 * calculadas -- esas se asumen columnas crudas de la fuente.
 */
function resolveRawCandidates(names: Iterable<string>, calculatedMeasures: Measure[]): Set<string> {
  const byName = new Map(calculatedMeasures.map((m) => [m.name, m]));
  const raw = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (raw.has(name) || visiting.has(name)) return;
    const measure = byName.get(name);
    if (!measure) {
      raw.add(name);
      return;
    }
    visiting.add(name);
    for (const id of engine.getAllIdentifiers(measure.expression)) visit(id);
    visiting.delete(name);
  }

  for (const name of names) visit(name);
  return raw;
}

/**
 * Columnas RAW proyectadas para una consulta de agregacion, validadas contra
 * el esquema real (`availableColumns`, de DESCRIBE) -- descarta nombres que
 * resultan ser medidas auto-inferidas sin columna propia (ej. "registros" =
 * COUNT()) o cualquier cosa que no exista realmente en la tabla.
 */
export function resolveNeededColumns(
  mode: "stat" | "tree",
  query: StatQuery | TreeQuery,
  calculatedMeasures: Measure[],
  activeFilters: ActiveFilters,
  availableColumns: Set<string>
): string[] {
  const seeds: string[] =
    mode === "tree"
      ? [...(query as TreeQuery).groupByColumns, ...(query as TreeQuery).valueColumns]
      : [
          (query as StatQuery).yKey,
          (query as StatQuery).breakdownKey,
          (query as StatQuery).granoKey,
        ].filter((s): s is string => !!s);

  const candidates = resolveRawCandidates(
    [...seeds, ...Object.keys(activeFilters ?? {})],
    calculatedMeasures
  );

  return Array.from(candidates).filter((c) => availableColumns.has(c));
}
