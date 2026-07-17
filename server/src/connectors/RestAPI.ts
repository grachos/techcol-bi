import axios, { AxiosError, Method } from "axios";
import { BaseConnector, RuntimeParams } from "./BaseConnector";
import { assertPublicUrl } from "../utils/security";
import {
  getCachedToken,
  setCachedToken,
  invalidateToken,
} from "../services/auth-token-cache";

export interface RestAPIConfig {
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  /** Ruta opcional dentro de la respuesta, ej: "data.items" */
  dataPath?: string;

  /**
   * Parametros de consulta enviados a la API. El valor puede ser literal
   * ("activo") o una plantilla que toma el valor de un filtro del dashboard:
   *   { fecha_inicio: "{{from}}", fecha_fin: "{{to}}" }
   * Un parametro cuya plantilla no tenga valor disponible se omite de la URL,
   * en vez de mandarse vacio o con la plantilla sin resolver.
   */
  queryParams?: Record<string, string>;

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
  /** Minutos que se reutiliza el token antes de volver a autenticar (default: 10) */
  authTokenTtlMin?: number;
}

const TEMPLATE = /^\{\{\s*([\w.]+)\s*\}\}$/;

/** Extrae un valor anidado por ruta "a.b.c". */
function pickPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<any>((acc, key) => acc?.[key], source);
}

export class RestAPIConnector extends BaseConnector {
  constructor(private cfg: RestAPIConfig) {
    super();
    if (!cfg.url) throw new Error("RestAPI: falta 'url' en la configuracion");
  }

  /**
   * Resuelve las plantillas de queryParams contra los filtros activos.
   * Omite los parametros sin valor para no enviar filtros vacios.
   */
  private resolveQueryParams(params: RuntimeParams): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, template] of Object.entries(this.cfg.queryParams ?? {})) {
      const match = TEMPLATE.exec(String(template));
      if (!match) {
        out[key] = String(template); // valor literal
        continue;
      }
      const value = params[match[1]];
      if (value !== undefined && value !== "") out[key] = value;
    }
    return out;
  }

  /**
   * Token del auth encadenado, reutilizado desde el cache mientras siga
   * vigente. `forceRefresh` lo pide de nuevo tras un 401.
   */
  private async getAuthToken(forceRefresh = false): Promise<string | null> {
    const { authUrl, authBody } = this.cfg;
    if (!authUrl) return null;

    if (!forceRefresh) {
      const cached = getCachedToken(authUrl, authBody);
      if (cached) return cached;
    }

    await assertPublicUrl(authUrl);
    let token: unknown;
    try {
      const response = await axios({
        method: this.cfg.authMethod ?? "POST",
        url: authUrl,
        data: authBody,
        headers: this.cfg.authHeaders ?? {},
        timeout: 15_000,
      });
      token = this.cfg.authTokenPath
        ? pickPath(response.data, this.cfg.authTokenPath)
        : response.data;
    } catch (error) {
      throw new Error(
        `Error obteniendo token de autenticación: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!token || typeof token !== "string") {
      throw new Error(
        "No se pudo extraer el token de la respuesta de autenticación"
      );
    }

    setCachedToken(
      authUrl,
      authBody,
      token,
      (this.cfg.authTokenTtlMin ?? 10) * 60_000
    );
    return token;
  }

  private async request(
    params: RuntimeParams,
    forceRefreshToken: boolean
  ): Promise<unknown> {
    const headers = this.cfg.headers ? { ...this.cfg.headers } : {};

    if (this.cfg.authUrl) {
      const token = await this.getAuthToken(forceRefreshToken);
      const headerKey = this.cfg.tokenHeaderKey ?? "Authorization";
      const prefix = this.cfg.tokenHeaderPrefix ?? "Bearer ";
      headers[headerKey] = `${prefix}${token}`;
    }

    await assertPublicUrl(this.cfg.url);
    const response = await axios({
      method: this.cfg.method ?? "GET",
      url: this.cfg.url,
      params: this.resolveQueryParams(params),
      headers,
      timeout: 15_000,
    });

    return this.cfg.dataPath
      ? pickPath(response.data, this.cfg.dataPath)
      : response.data;
  }

  async fetchData(params: RuntimeParams = {}): Promise<unknown> {
    try {
      return await this.request(params, false);
    } catch (error) {
      // Token cacheado rechazado: reautenticar una vez y reintentar.
      const status = (error as AxiosError)?.response?.status;
      if (this.cfg.authUrl && (status === 401 || status === 403)) {
        invalidateToken(this.cfg.authUrl, this.cfg.authBody);
        return this.request(params, true);
      }
      throw error;
    }
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
