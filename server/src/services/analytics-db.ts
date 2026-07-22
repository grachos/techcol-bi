/**
 * Motor analitico columnar (DuckDB embebido, un archivo local, sin servidor
 * aparte -- corre dentro del mismo proceso Express). Guarda una copia
 * SINCRONIZADA de los datos de negocio de cada conector (server/data/analytics.duckdb),
 * para consultarlos con SQL en vez de re-descargar y re-agregar en JS cada vez.
 *
 * No reemplaza MariaDB: los datos operativos de la app (usuarios, conectores,
 * dashboards) siguen alli. Esto es solo el almacen de las FILAS que las
 * fuentes externas producen.
 *
 * DESPLIEGUE (verificado 2026-07): @duckdb/node-bindings trae binarios
 * prebuilt via optionalDependencies (linux-x64, linux-x64-musl, linux-arm64,
 * linux-arm64-musl, darwin-x64/arm64, win32-x64/arm64) con seleccion
 * automatica por `detect-libc` -- no requiere compilador ni toolchain, solo
 * bajar el paquete correcto en `npm install`. El VPS de Hostinger (Ubuntu/
 * Debian/AlmaLinux/etc. sobre AMD64, root completo) encaja de lleno en
 * linux-x64: alta confianza.
 * El plan "Node.js Web App" (Business/Cloud, hosting administrado) NO tiene
 * su SO/arquitectura/soporte de addons nativos documentado publicamente --
 * sin poder probarlo ahi, no se puede dar por seguro. Ademas, aunque el
 * binario cargara, esta arquitectura (archivo local persistente + scheduler
 * en segundo plano via setInterval, ver sync-service.ts) no encaja bien con
 * una plataforma administrada pensada para procesos sin estado -- el VPS es
 * el objetivo de despliegue correcto para este proyecto, no solo por DuckDB.
 */
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import fs from "fs";
import os from "os";
import path from "path";

// process.cwd(), NO __dirname: npm siempre corre "dev"/"start" con cwd=server/,
// pero __dirname del archivo compilado queda a distinta profundidad segun el
// modo (dist/server/src/services/ en produccion vs server/src/services/ en
// dev, por el rootDir=".." que compila tambien el motor compartido del
// cliente -- ver server/tsconfig.json). cwd es estable en los dos casos.
const DB_PATH = path.join(process.cwd(), "data", "analytics.duckdb");

let connectionPromise: Promise<DuckDBConnection> | null = null;

/** Conexion unica y compartida (DuckDB soporta 1 escritor + N lectores por proceso). */
export async function getAnalyticsDb(): Promise<DuckDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const instance = await DuckDBInstance.create(DB_PATH);
      return instance.connect();
    })();
  }
  return connectionPromise;
}

export function factTableName(connectorId: number): string {
  // connectorId siempre es un entero (INT PRIMARY KEY de MariaDB, nunca
  // entrada de usuario), asi que interpolarlo en el nombre de tabla es seguro.
  return `fact_conn_${connectorId}`;
}

/** Escribe las filas a un archivo temporal (DuckDB parsea JSON directo del disco, sin copiar el array a su motor via JS). */
function writeTempJson(rows: unknown[]): string {
  const file = path.join(os.tmpdir(), `bi-sync-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(rows));
  return file;
}

/** Escapa una ruta de archivo para interpolarla en un literal SQL. */
function sqlPath(file: string): string {
  return file.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export async function tableExists(connectorId: number): Promise<boolean> {
  const conn = await getAnalyticsDb();
  const res = await conn.runAndReadAll(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [factTableName(connectorId)]
  );
  return res.getRowObjectsJson().length > 0;
}

/**
 * Reemplaza TODA la tabla de hechos del conector con las filas dadas. DuckDB
 * infiere el esquema del JSON (fechas, numeros, texto) -- no hay mapeo de
 * tipos manual. Atomico: si falla, la tabla anterior queda intacta (el
 * CREATE OR REPLACE solo se ejecuta si el archivo se pudo leer bien).
 */
export async function fullRefresh(connectorId: number, rows: unknown[]): Promise<number> {
  const conn = await getAnalyticsDb();
  const table = factTableName(connectorId);
  if (rows.length === 0) {
    await conn.run(`CREATE OR REPLACE TABLE "${table}" (_empty BOOLEAN)`);
    return 0;
  }
  const file = writeTempJson(rows);
  try {
    await conn.run(
      `CREATE OR REPLACE TABLE "${table}" AS SELECT * FROM read_json_auto('${sqlPath(file)}', format='array')`
    );
  } finally {
    fs.unlink(file, () => {});
  }
  return getRowCount(connectorId);
}

/**
 * Borra las filas desde `sinceDay` (inclusive) y reinserta el lote nuevo,
 * forzando el mismo esquema de columnas que ya tiene la tabla (evita que un
 * lote incremental con menos filas infiera tipos distintos y rompa el INSERT).
 * Si la tabla no existe todavia, cae a fullRefresh.
 */
export async function incrementalRefresh(
  connectorId: number,
  rows: unknown[],
  dateColumn: string,
  sinceDay: string
): Promise<number> {
  const conn = await getAnalyticsDb();
  const table = factTableName(connectorId);
  if (!(await tableExists(connectorId))) {
    return fullRefresh(connectorId, rows);
  }

  const schema = await conn.runAndReadAll(`DESCRIBE "${table}"`);
  const columns = schema.getRowObjectsJson() as { column_name: string; column_type: string }[];
  const columnsMap = columns.map((c) => `'${c.column_name}': '${c.column_type}'`).join(", ");

  await conn.run(`DELETE FROM "${table}" WHERE CAST("${dateColumn}" AS VARCHAR) >= $1`, [sinceDay]);

  if (rows.length > 0) {
    const file = writeTempJson(rows);
    try {
      await conn.run(
        `INSERT INTO "${table}" SELECT * FROM read_json_auto('${sqlPath(file)}', format='array', columns={${columnsMap}})`
      );
    } finally {
      fs.unlink(file, () => {});
    }
  }
  return getRowCount(connectorId);
}

export async function getRowCount(connectorId: number): Promise<number> {
  const conn = await getAnalyticsDb();
  const res = await conn.runAndReadAll(`SELECT COUNT(*)::INTEGER AS n FROM "${factTableName(connectorId)}"`);
  const row = res.getRowObjectsJson()[0] as { n: number } | undefined;
  return row?.n ?? 0;
}

export async function getMaxDate(connectorId: number, dateColumn: string): Promise<string | null> {
  const conn = await getAnalyticsDb();
  const res = await conn.runAndReadAll(
    `SELECT MAX(CAST("${dateColumn}" AS VARCHAR)) AS d FROM "${factTableName(connectorId)}"`
  );
  const row = res.getRowObjectsJson()[0] as { d: string | null } | undefined;
  return row?.d ?? null;
}

export async function getMinAndMaxDate(
  connectorId: number,
  dateColumn: string
): Promise<{ minDate: string | null; maxDate: string | null }> {
  try {
    const conn = await getAnalyticsDb();
    const res = await conn.runAndReadAll(
      `SELECT MIN(CAST("${dateColumn}" AS VARCHAR)) AS min_d, MAX(CAST("${dateColumn}" AS VARCHAR)) AS max_d FROM "${factTableName(connectorId)}"`
    );
    const row = res.getRowObjectsJson()[0] as { min_d: string | null; max_d: string | null } | undefined;
    return { minDate: row?.min_d ?? null, maxDate: row?.max_d ?? null };
  } catch {
    return { minDate: null, maxDate: null };
  }
}

export async function dropTable(connectorId: number): Promise<void> {
  const conn = await getAnalyticsDb();
  await conn.run(`DROP TABLE IF EXISTS "${factTableName(connectorId)}"`);
}

/** Nombres de columna reales de la tabla de hechos (para validar filtros antes de interpolarlos en SQL). */
export async function getFactColumns(connectorId: number): Promise<Set<string>> {
  const conn = await getAnalyticsDb();
  const res = await conn.runAndReadAll(`DESCRIBE "${factTableName(connectorId)}"`);
  const rows = res.getRowObjectsJson() as { column_name: string }[];
  return new Set(rows.map((r) => r.column_name));
}

/**
 * Consulta la tabla de hechos con un WHERE ya armado (ver filter-sql.ts) --
 * el filtrado corre en DuckDB, no en JS: solo las filas que hacen falta
 * cruzan hacia la agregacion, sin re-descargar ni recorrer todo el dataset.
 */
/**
 * `columns`: si se da (no vacio), proyecta solo esas columnas en vez de
 * SELECT * -- Silog tiene 68 columnas por fila; perfilado mostro que
 * materializar/mover objetos de fila anchos (no la reconstruccion del arbol)
 * era el costo dominante en consultas grandes. Los nombres deben venir YA
 * validados contra el esquema real (ver resolveNeededColumns) -- se
 * interpolan directo en el SQL.
 */
export async function queryFactRows(
  connectorId: number,
  whereSql: string,
  values: string[],
  columns?: string[] | null
): Promise<Record<string, unknown>[]> {
  const conn = await getAnalyticsDb();
  const table = factTableName(connectorId);
  const selectList =
    columns && columns.length > 0 ? columns.map((c) => `"${c}"`).join(", ") : "*";
  const sql = `SELECT ${selectList} FROM "${table}" ${whereSql}`;
  const res =
    values.length > 0 ? await conn.runAndReadAll(sql, values) : await conn.runAndReadAll(sql);
  return res.getRowObjectsJson() as Record<string, unknown>[];
}
