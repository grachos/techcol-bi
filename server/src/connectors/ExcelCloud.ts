import axios from "axios";
import * as XLSX from "xlsx";
import { BaseConnector } from "./BaseConnector";
import { assertPublicUrl } from "../utils/security";

export interface ExcelCloudConfig {
  // URL del archivo Excel en la nube (ej: Google Drive, OneDrive, Dropbox)
  url: string;
  // O el ID del archivo (usamos URL como fallback si no está url)
  fileId?: string;
  // Proveedor: "google_drive", "onedrive", "dropbox", "direct_url"
  provider?: "google_drive" | "onedrive" | "dropbox" | "direct_url";
  // Sheet name to read, or array of sheets for relationships
  sheet?: string;
  sheets?: string[];
  // Relationships between sheets
  relationships?: Array<{
    from: string; // "SheetName:ColumnName"
    to: string;   // "SheetName:ColumnName"
    name: string; // nombre del campo anidado
  }>;
}

export class ExcelCloudConnector extends BaseConnector {
  constructor(private cfg: ExcelCloudConfig) {
    super();
    if (!cfg.url && !cfg.fileId) {
      throw new Error("ExcelCloud: falta 'url' o 'fileId' en la configuracion");
    }
  }

  private buildDownloadUrl(): string {
    if (this.cfg.url) return this.cfg.url;

    const provider = this.cfg.provider || "google_drive";
    const fileId = this.cfg.fileId!;

    switch (provider) {
      case "google_drive":
        // Google Drive export link
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      case "onedrive":
        // OneDrive API
        return `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
      case "dropbox":
        // Dropbox direct download
        return `https://dl.dropboxusercontent.com/s/${fileId}?dl=1`;
      default:
        throw new Error(`Proveedor no soportado: ${provider}`);
    }
  }

  private async downloadFile(): Promise<Buffer> {
    const url = this.buildDownloadUrl();
    await assertPublicUrl(url);
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });
    return Buffer.from(response.data);
  }

  private getWorkbook() {
    // Este método necesita ser async en fetchData
    return null; // Placeholder
  }

  private async fetchSheet(sheetName: string, workbook: XLSX.WorkBook): Promise<Record<string, any>[]> {
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`ExcelCloud: hoja "${sheetName}" no encontrada`);
    }

    const rows = XLSX.utils.sheet_to_json(worksheet);
    return rows as Record<string, any>[];
  }

  async fetchData(): Promise<unknown> {
    // Descargar el archivo
    const buffer = await this.downloadFile();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Si no hay múltiples hojas, usar el método simple
    if (!this.cfg.sheets || this.cfg.sheets.length === 0) {
      const sheetName = this.cfg.sheet || workbook.SheetNames[0];
      return this.fetchSheet(sheetName, workbook);
    }

    // Traer múltiples hojas
    const sheetsData: Record<string, Record<string, any>[]> = {};
    for (const sheetName of this.cfg.sheets) {
      sheetsData[sheetName] = await this.fetchSheet(sheetName, workbook);
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
