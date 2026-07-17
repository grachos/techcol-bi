/**
 * Valores de los filtros activos del dashboard que llegan al conector en el
 * momento de la consulta (ej. { from: "2026-01-01", to: "2026-01-31" }).
 * Los conectores que filtran en el origen los usan; el resto los ignora y
 * sigue filtrandose del lado del cliente.
 */
export type RuntimeParams = Record<string, string>;

/**
 * Contrato que todo conector de fuente de datos debe cumplir.
 * Cada conector sabe como conectarse, traer datos y validar la conexion.
 */
export abstract class BaseConnector {
  abstract fetchData(params?: RuntimeParams): Promise<unknown>;
  abstract testConnection(): Promise<boolean>;

  // Opcional: obtener schema (tablas y columnas) de la BD
  async getSchema?(): Promise<{ tables: Array<{ name: string; columns: string[] }> }>;
}

export type ConnectorType =
  | "rest_api"
  | "google_sheets"
  | "mysql"
  | "postgresql"
  | "csv"
  | "excel"
  | "excel_cloud";

export const CONNECTOR_TYPES: ConnectorType[] = [
  "rest_api",
  "google_sheets",
  "mysql",
  "postgresql",
  "csv",
  "excel",
  "excel_cloud",
];
