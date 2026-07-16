import * as XLSX from "xlsx";
import { BaseConnector } from "./BaseConnector";

export interface ExcelConfig {
  // Base64 encoded Excel file
  fileData: string;
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

export class ExcelConnector extends BaseConnector {
  constructor(private cfg: ExcelConfig) {
    super();
    if (!cfg.fileData) throw new Error("Excel: falta 'fileData' en la configuracion");
  }

  private getWorkbook() {
    const buffer = Buffer.from(this.cfg.fileData, "base64");
    return XLSX.read(buffer, { type: "buffer" });
  }

  private fetchSheet(sheetName: string): Record<string, any>[] {
    const workbook = this.getWorkbook();
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`Excel: hoja "${sheetName}" no encontrada`);
    }

    const rows = XLSX.utils.sheet_to_json(worksheet);
    return rows as Record<string, any>[];
  }

  async fetchData(): Promise<unknown> {
    // Si no hay múltiples hojas, usar el método simple
    if (!this.cfg.sheets || this.cfg.sheets.length === 0) {
      const sheetName = this.cfg.sheet || "Sheet1";
      return this.fetchSheet(sheetName);
    }

    // Traer múltiples hojas
    const sheetsData: Record<string, Record<string, any>[]> = {};
    for (const sheetName of this.cfg.sheets) {
      sheetsData[sheetName] = this.fetchSheet(sheetName);
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
