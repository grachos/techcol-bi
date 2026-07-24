import { test } from "node:test";
import assert from "node:assert/strict";
import { decideRawStat } from "./cached-aggregate";
import type { StatQuery } from "./aggregation-service";

/**
 * decideRawStat es el guardia del atajo de DuckDB: solo debe devolver "sql"
 * cuando agregar en SQL es demostrablemente equivalente al camino JS. Un
 * "sql" de mas puede dar un numero EQUIVOCADO (silencioso), asi que estos
 * tests fijan cada condicion que obliga a caer al pipeline JS ("fallback").
 */

const COLUMNS = new Set(["total_remesa", "registros_col", "tipo_operacion", "fecha"]);
const NO_MEASURES = new Set<string>();

function q(partial: Partial<StatQuery>): StatQuery {
  return { yKey: null, ...partial };
}

test("suma sobre columna real, sin filtros -> sql", () => {
  assert.equal(
    decideRawStat(q({ yKey: "total_remesa", aggregation: "sum" }), COLUMNS, NO_MEASURES, []),
    "sql"
  );
});

test("agregacion por defecto (undefined) se trata como suma -> sql", () => {
  assert.equal(
    decideRawStat(q({ yKey: "total_remesa" }), COLUMNS, NO_MEASURES, []),
    "sql"
  );
});

test("count sin yKey -> sql", () => {
  assert.equal(
    decideRawStat(q({ yKey: null, aggregation: "count" }), COLUMNS, NO_MEASURES, []),
    "sql"
  );
});

test("avg/min/max sin yKey -> fallback (no hay nada que agregar)", () => {
  for (const aggregation of ["avg", "min", "max", "sum"] as const) {
    assert.equal(
      decideRawStat(q({ yKey: null, aggregation }), COLUMNS, NO_MEASURES, []),
      "fallback",
      `aggregation=${aggregation}`
    );
  }
});

test("con desglose (breakdownKey) -> fallback (arma arbol, no escalar)", () => {
  assert.equal(
    decideRawStat(
      q({ yKey: "total_remesa", aggregation: "sum", breakdownKey: "tipo_operacion" }),
      COLUMNS,
      NO_MEASURES,
      []
    ),
    "fallback"
  );
});

test("con grano hoja (granoKey) -> fallback", () => {
  assert.equal(
    decideRawStat(
      q({ yKey: "total_remesa", aggregation: "sum", granoKey: "manifiesto" }),
      COLUMNS,
      NO_MEASURES,
      []
    ),
    "fallback"
  );
});

test("yKey no es una columna real -> fallback", () => {
  assert.equal(
    decideRawStat(q({ yKey: "rentabilidad", aggregation: "sum" }), COLUMNS, NO_MEASURES, []),
    "fallback"
  );
});

test("yKey es una medida calculada del usuario (aunque comparta nombre) -> fallback", () => {
  const columnsWithMeasureName = new Set([...COLUMNS, "margen"]);
  assert.equal(
    decideRawStat(
      q({ yKey: "margen", aggregation: "sum" }),
      columnsWithMeasureName,
      new Set(["margen"]),
      []
    ),
    "fallback"
  );
});

test("filtro sobre columna real -> sql", () => {
  assert.equal(
    decideRawStat(q({ yKey: "total_remesa", aggregation: "sum" }), COLUMNS, NO_MEASURES, [
      "tipo_operacion",
    ]),
    "sql"
  );
});

test("filtro sobre dimension calculada (no existe en la tabla) -> fallback", () => {
  // "mes" = MONTH(fecha): buildWhereClause lo ignoraria y el numero saldria mal.
  assert.equal(
    decideRawStat(q({ yKey: "total_remesa", aggregation: "sum" }), COLUMNS, NO_MEASURES, ["mes"]),
    "fallback"
  );
});

test("basta UN filtro invalido entre varios para caer a fallback", () => {
  assert.equal(
    decideRawStat(q({ yKey: "total_remesa", aggregation: "sum" }), COLUMNS, NO_MEASURES, [
      "tipo_operacion",
      "mes",
    ]),
    "fallback"
  );
});
