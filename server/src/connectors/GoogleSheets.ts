import { google } from "googleapis";
import { BaseConnector } from "./BaseConnector";

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  range?: string;
  /** JSON del service account (string) con permiso de lectura en la hoja */
  serviceAccountKey: string;
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

  async fetchData(): Promise<unknown> {
    const sheets = google.sheets({ version: "v4", auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range: this.cfg.range ?? "Sheet1",
    });

    const rows = response.data.values ?? [];
    if (rows.length < 2) return rows;

    // Primera fila = encabezados -> array de objetos
    const [headers, ...body] = rows;
    return body.map((row) =>
      Object.fromEntries(headers.map((h: string, i: number) => [h, row[i]]))
    );
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
