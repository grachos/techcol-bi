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
  private connectorId: number | null = null

  constructor(
    private readonly storageKey: string,
    private readonly onSave?: (connectorId: number, measures: Measure[]) => void
  ) {
    const match = storageKey.match(/semantic-connector-(\d+)-metrics/)
    if (match) {
      this.connectorId = parseInt(match[1], 10)
    }
  }

  load(): Measure[] {
    try {
      const raw = localStorage.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as Measure[]) : []
    } catch {
      return []
    }
  }

  saveLocalOnly(measures: Measure[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(measures))
    } catch {
      // ignore
    }
  }

  save(measures: Measure[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(measures))
      if (this.connectorId && this.onSave) {
        this.onSave(this.connectorId, measures)
      }
    } catch {
      // ignore
    }
  }
}
