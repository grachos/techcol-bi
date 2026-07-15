import { BaseConnector } from "./BaseConnector";

interface CSVConfig {
  csvData: string; // CSV content as string (base64 encoded)
}

export class CSV extends BaseConnector {
  private config: CSVConfig;

  constructor(config: unknown) {
    super();
    if (!config || typeof config !== "object") {
      throw new Error("CSV config must be an object");
    }
    const c = config as Record<string, unknown>;
    if (typeof c.csvData !== "string") {
      throw new Error("csvData must be a base64-encoded string");
    }
    this.config = { csvData: c.csvData as string };
  }

  async fetchData(): Promise<unknown> {
    try {
      const decoded = Buffer.from(this.config.csvData, "base64").toString(
        "utf-8"
      );
      return this.parseCSV(decoded);
    } catch (error) {
      throw new Error(
        `Error parsing CSV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const data = await this.fetchData();
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  private parseCSV(csvContent: string): Record<string, unknown>[] {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    const headers = this.parseCSVLine(lines[0]);
    if (headers.length === 0) {
      throw new Error("CSV header is empty");
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? "";
      });
      rows.push(row);
    }

    return rows;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}
