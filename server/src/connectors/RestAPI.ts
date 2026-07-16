import axios, { Method } from "axios";
import { BaseConnector } from "./BaseConnector";

export interface RestAPIConfig {
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  /** Ruta opcional dentro de la respuesta, ej: "data.items" */
  dataPath?: string;

  // Autenticación encadenada (obtener token de otra API)
  authUrl?: string;
  authMethod?: Method;
  authBody?: Record<string, any>;
  authHeaders?: Record<string, string>;
  /** Ruta al token en la respuesta de autenticación, ej: "access_token" o "data.token" */
  authTokenPath?: string;
  /** Header donde incluir el token (default: "Authorization") */
  tokenHeaderKey?: string;
  /** Prefijo del token (default: "Bearer ") */
  tokenHeaderPrefix?: string;
}

export class RestAPIConnector extends BaseConnector {
  constructor(private cfg: RestAPIConfig) {
    super();
    if (!cfg.url) throw new Error("RestAPI: falta 'url' en la configuracion");
  }

  /**
   * Obtiene el token de la API de autenticación si está configurada
   */
  private async getAuthToken(): Promise<string | null> {
    if (!this.cfg.authUrl) return null;

    try {
      const response = await axios({
        method: this.cfg.authMethod ?? "POST",
        url: this.cfg.authUrl,
        data: this.cfg.authBody,
        headers: this.cfg.authHeaders ?? {},
        timeout: 15_000,
      });

      let token: any = response.data;

      // Extraer el token usando la ruta especificada
      if (this.cfg.authTokenPath) {
        for (const key of this.cfg.authTokenPath.split(".")) {
          token = token?.[key];
        }
      }

      if (!token || typeof token !== "string") {
        throw new Error("No se pudo extraer el token de la respuesta de autenticación");
      }

      return token;
    } catch (error) {
      throw new Error(
        `Error obteniendo token de autenticación: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async fetchData(): Promise<unknown> {
    // Obtener token si está configurada autenticación encadenada
    let headers = this.cfg.headers ? { ...this.cfg.headers } : {};
    if (this.cfg.authUrl) {
      const token = await this.getAuthToken();
      const headerKey = this.cfg.tokenHeaderKey ?? "Authorization";
      const prefix = this.cfg.tokenHeaderPrefix ?? "Bearer ";
      headers[headerKey] = `${prefix}${token}`;
    }

    const response = await axios({
      method: this.cfg.method ?? "GET",
      url: this.cfg.url,
      headers,
      timeout: 15_000,
    });

    let data: any = response.data;
    if (this.cfg.dataPath) {
      for (const key of this.cfg.dataPath.split(".")) {
        data = data?.[key];
      }
    }
    return data;
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
