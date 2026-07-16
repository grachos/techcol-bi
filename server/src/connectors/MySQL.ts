import mysql from "mysql2/promise";
import { BaseConnector } from "./BaseConnector";

export interface MySQLConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  /** Consulta SELECT que define los datos del conector */
  query: string;
}

const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i;

export class MySQLConnector extends BaseConnector {
  constructor(private cfg: MySQLConfig) {
    super();
    if (!cfg.host || !cfg.user || !cfg.database || !cfg.query) {
      throw new Error("MySQL: config incompleta (host, user, database, query)");
    }
    if (FORBIDDEN.test(cfg.query)) {
      throw new Error("MySQL: solo se permiten consultas de lectura (SELECT)");
    }
  }

  private async withConnection<T>(
    fn: (conn: mysql.Connection) => Promise<T>
  ): Promise<T> {
    const conn = await mysql.createConnection({
      host: this.cfg.host,
      port: this.cfg.port ?? 3306,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      connectTimeout: 10_000,
    });
    try {
      return await fn(conn);
    } finally {
      await conn.end();
    }
  }

  async fetchData(): Promise<unknown> {
    return this.withConnection(async (conn) => {
      const [rows] = await conn.query(this.cfg.query);
      return rows;
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.withConnection((conn) => conn.ping());
      return true;
    } catch {
      return false;
    }
  }

  async getSchema(): Promise<{ tables: Array<{ name: string; columns: string[] }> }> {
    return this.withConnection(async (conn) => {
      const [tables]: any = await conn.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
      );
      const result: Array<{ name: string; columns: string[] }> = [];

      for (const table of tables) {
        const tableName = table.TABLE_NAME;
        const [columns]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [tableName]
        );
        result.push({
          name: tableName,
          columns: columns.map((c: any) => c.COLUMN_NAME),
        });
      }

      return { tables: result };
    });
  }
}
