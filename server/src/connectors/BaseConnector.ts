/**
 * Contrato que todo conector de fuente de datos debe cumplir.
 * Cada conector sabe como conectarse, traer datos y validar la conexion.
 */
export abstract class BaseConnector {
  abstract fetchData(): Promise<unknown>;
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
