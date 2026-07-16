import { Client } from "pg";
import { BaseConnector } from "./BaseConnector";

export interface PostgreSQLConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  /** Consulta SELECT que define los datos del conector */
  query: string;
}

const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i;

export class PostgreSQLConnector extends BaseConnector {
  constructor(private cfg: PostgreSQLConfig) {
    super();
    if (!cfg.host || !cfg.user || !cfg.database || !cfg.query) {
      throw new Error(
        "PostgreSQL: config incompleta (host, user, database, query)"
      );
    }
    if (FORBIDDEN.test(cfg.query)) {
      throw new Error(
        "PostgreSQL: solo se permiten consultas de lectura (SELECT)"
      );
    }
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({
      host: this.cfg.host,
      port: this.cfg.port ?? 5432,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  async fetchData(): Promise<unknown> {
    return this.withClient(async (client) => {
      const result = await client.query(this.cfg.query);
      return result.rows;
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.withClient((client) => client.query("SELECT 1"));
      return true;
    } catch {
      return false;
    }
  }

  async getSchema(): Promise<{ tables: Array<{ name: string; columns: string[] }> }> {
    return this.withClient(async (client) => {
      const result = await client.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      );
      const tables = result.rows.map((r: any) => r.tablename);
      const schemaResult: Array<{ name: string; columns: string[] }> = [];

      for (const tableName of tables) {
        const columnsResult = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tableName]
        );
        schemaResult.push({
          name: tableName,
          columns: columnsResult.rows.map((c: any) => c.column_name),
        });
      }

      return { tables: schemaResult };
    });
  }
}
