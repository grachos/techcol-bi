import { BaseConnector, ConnectorType } from "./BaseConnector";
import { RestAPIConnector } from "./RestAPI";
import { GoogleSheetsConnector } from "./GoogleSheets";
import { MySQLConnector } from "./MySQL";
import { PostgreSQLConnector } from "./PostgreSQL";

export class ConnectorFactory {
  static create(type: ConnectorType, config: any): BaseConnector {
    switch (type) {
      case "rest_api":
        return new RestAPIConnector(config);
      case "google_sheets":
        return new GoogleSheetsConnector(config);
      case "mysql":
        return new MySQLConnector(config);
      case "postgresql":
        return new PostgreSQLConnector(config);
      default:
        throw new Error(`Tipo de conector no soportado: ${type}`);
    }
  }
}
