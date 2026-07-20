import type { Measure } from './types'

/**
 * Persistencia de las medidas calculadas por el usuario. Pluggable: el
 * default es localStorage, pero se puede inyectar una implementacion
 * respaldada por API/BD sin tocar el resto de la Semantic Layer.
 */
export interface MetricsRepository {
  load(): Measure[]
  save(measures: Measure[]): void
}

export class InMemoryMetricsRepository implements MetricsRepository {
  private measures: Measure[] = []

  load(): Measure[] {
    return this.measures
  }

  save(measures: Measure[]): void {
    this.measures = measures
  }
}

export class LocalStorageMetricsRepository implements MetricsRepository {
  constructor(private readonly storageKey: string) {}

  load(): Measure[] {
    try {
      const raw = localStorage.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as Measure[]) : []
    } catch {
      return []
    }
  }

  save(measures: Measure[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(measures))
    } catch {
      // almacenamiento no disponible (modo privado, cuota excedida): se ignora,
      // las medidas calculadas quedan solo en memoria para esta sesion
    }
  }
}
