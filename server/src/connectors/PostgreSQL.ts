import { Client } from "pg";
import { BaseConnector } from "./BaseConnector";

/**
 * Recomendado: usar un usuario de BD de solo lectura (GRANT SELECT ...) para
 * `user`/`password`. El filtro FORBIDDEN de abajo es una segunda capa, no un
 * sustituto de permisos reales a nivel de base de datos.
 */
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
      // Una sola consulta en vez de 1 + N (una por tabla)
      const result = await client.query(
        `SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS columns
         FROM information_schema.columns
         WHERE table_schema = 'public'
         GROUP BY table_name`
      );

      return {
        tables: result.rows.map((r: any) => ({
          name: r.table_name,
          columns: (r.columns as string).split(","),
        })),
      };
    });
  }
}
