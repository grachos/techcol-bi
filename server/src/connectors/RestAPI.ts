import axios, { Method } from "axios";
import { BaseConnector } from "./BaseConnector";

export interface RestAPIConfig {
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  /** Ruta opcional dentro de la respuesta, ej: "data.items" */
  dataPath?: string;
}

export class RestAPIConnector extends BaseConnector {
  constructor(private cfg: RestAPIConfig) {
    super();
    if (!cfg.url) throw new Error("RestAPI: falta 'url' en la configuracion");
  }

  async fetchData(): Promise<unknown> {
    const response = await axios({
      method: this.cfg.method ?? "GET",
      url: this.cfg.url,
      headers: this.cfg.headers ?? {},
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
