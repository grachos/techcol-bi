import { google } from "googleapis";
import { BaseConnector } from "./BaseConnector";

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  range?: string;
  /** JSON del service account (string) con permiso de lectura en la hoja */
  serviceAccountKey: string;

  // Para múltiples hojas relacionales
  /** Array de hojas a traer, ej: ["Usuarios", "Pedidos"] */
  sheets?: string[];
  /** Array de relaciones, ej: [{from: "Usuarios:ID", to: "Pedidos:UsuarioID", name: "pedidos"}] */
  relationships?: Array<{
    from: string; // "SheetName:ColumnName"
    to: string;   // "SheetName:ColumnName"
    name: string; // nombre del campo anidado
  }>;
}

export class GoogleSheetsConnector extends BaseConnector {
  private auth;

  constructor(private cfg: GoogleSheetsConfig) {
    super();
    if (!cfg.spreadsheetId)
      throw new Error("GoogleSheets: falta 'spreadsheetId'");
    if (!cfg.serviceAccountKey)
      throw new Error("GoogleSheets: falta 'serviceAccountKey'");

    this.auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(cfg.serviceAccountKey),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  private async fetchSheet(sheetName: string): Promise<Record<string, any>[]> {
    const sheets = google.sheets({ version: "v4", auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range: sheetName,
    });

    const rows = response.data.values ?? [];
    if (rows.length < 2) return [];

    // Primera fila = encabezados -> array de objetos
    const [headers, ...body] = rows;
    return body.map((row) =>
      Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] ?? null]))
    );
  }

  async fetchData(): Promise<unknown> {
    // Si no hay múltiples hojas, usar el método simple
    if (!this.cfg.sheets || this.cfg.sheets.length === 0) {
      const sheets = google.sheets({ version: "v4", auth: this.auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.cfg.spreadsheetId,
        range: this.cfg.range ?? "Sheet1",
      });

      const rows = response.data.values ?? [];
      if (rows.length < 2) return rows;

      const [headers, ...body] = rows;
      return body.map((row) =>
        Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] ?? null]))
      );
    }

    // Traer múltiples hojas
    const sheetsData: Record<string, Record<string, any>[]> = {};
    for (const sheetName of this.cfg.sheets) {
      sheetsData[sheetName] = await this.fetchSheet(sheetName);
    }

    // Hacer JOINs si hay relaciones
    if (!this.cfg.relationships || this.cfg.relationships.length === 0) {
      return Object.values(sheetsData).flat();
    }

    // Empezar con la primera hoja
    const mainSheetName = this.cfg.sheets[0];
    let result = sheetsData[mainSheetName];

    // Aplicar cada relación
    for (const rel of this.cfg.relationships) {
      const [fromSheet, fromCol] = rel.from.split(":");
      const [toSheet, toCol] = rel.to.split(":");

      const toData = sheetsData[toSheet];
      if (!toData) continue;

      // JOIN manual: agregar datos relacionados a cada fila
      result = result.map((mainRow) => ({
        ...mainRow,
        [rel.name]: toData.filter(
          (relRow) => String(relRow[toCol]) === String(mainRow[fromCol])
        ),
      }));
    }

    return result;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchData();
      return true;
    } catch {
      return false;
    }
  }
}
