/**
 * Contrato que todo conector de fuente de datos debe cumplir.
 * Cada conector sabe como conectarse, traer datos y validar la conexion.
 */
export abstract class BaseConnector {
  abstract fetchData(): Promise<unknown>;
  abstract testConnection(): Promise<boolean>;
}

export type ConnectorType =
  | "rest_api"
  | "google_sheets"
  | "mysql"
  | "postgresql";

export const CONNECTOR_TYPES: ConnectorType[] = [
  "rest_api",
  "google_sheets",
  "mysql",
  "postgresql",
];
