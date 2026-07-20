import { ExpressionEngine } from './expression'
import type { MetricsRepository } from './repository'
import type {
  Dimension,
  FieldCatalogEntry,
  Kpi,
  Measure,
  Relationship,
} from './types'

export interface SemanticModelOptions {
  engine?: ExpressionEngine
  repository?: MetricsRepository
}

/**
 * Registro central de metricas, dimensiones, KPIs y relaciones. Ningun
 * widget calcula agregaciones por si mismo: todos leen de aqui a traves
 * del Query Engine, que a su vez usa el Expression Engine expuesto en
 * `getExpressionEngine()`.
 */
export class SemanticModel {
  private readonly dimensions = new Map<string, Dimension>()
  private readonly measures = new Map<string, Measure>()
  private readonly kpis = new Map<string, Kpi>()
  private readonly relationships = new Map<string, Relationship>()
  private readonly engine: ExpressionEngine
  private readonly repository?: MetricsRepository
  private readonly listeners = new Set<() => void>()
  private version = 0

  constructor(options: SemanticModelOptions = {}) {
    this.engine = options.engine ?? new ExpressionEngine()
    this.repository = options.repository
    if (this.repository) {
      for (const measure of this.repository.load()) {
        this.measures.set(measure.name, measure)
      }
    }
  }

  getExpressionEngine(): ExpressionEngine {
    return this.engine
  }

  /** Compatibilidad con useSyncExternalStore para que los componentes se re-rendericen ante cambios del modelo. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  private notify() {
    this.version++
    this.listeners.forEach((listener) => listener())
  }

  // ── Dimensiones ────────────────────────────────────────────
  registerDimension(dimension: Dimension) {
    this.dimensions.set(dimension.name, dimension)
    this.notify()
  }

  getDimension(name: string): Dimension | undefined {
    return this.dimensions.get(name)
  }

  listDimensions(): Dimension[] {
    return Array.from(this.dimensions.values())
  }

  // ── Medidas (base y calculadas) ───────────────────────────
  registerMeasure(measure: Measure) {
    this.validateMeasure(measure)
    this.measures.set(measure.name, measure)
    this.notify()
    this.persistCalculatedMeasures()
  }

  removeMeasure(name: string) {
    const existing = this.measures.get(name)
    if (!existing) return
    const dependents = this.listMeasures().filter(
      (m) => m.name !== name && this.getDependencies(m.name).includes(name)
    )
    if (dependents.length > 0) {
      throw new Error(
        `No se puede eliminar "${name}": la usan ${dependents.map((d) => d.name).join(', ')}`
      )
    }
    this.measures.delete(name)
    this.notify()
    this.persistCalculatedMeasures()
  }

  getMeasure(name: string): Measure | undefined {
    return this.measures.get(name)
  }

  listMeasures(): Measure[] {
    return Array.from(this.measures.values())
  }

  private persistCalculatedMeasures() {
    if (!this.repository) return
    this.repository.save(this.listMeasures().filter((m) => m.isCalculated))
  }

  // ── KPIs ───────────────────────────────────────────────────
  registerKpi(kpi: Kpi) {
    this.kpis.set(kpi.name, kpi)
    this.notify()
  }

  getKpi(name: string): Kpi | undefined {
    return this.kpis.get(name)
  }

  listKpis(): Kpi[] {
    return Array.from(this.kpis.values())
  }

  // ── Relaciones (metadatos; el Query Engine actual opera sobre una sola
  // fuente de filas, la ejecucion de joins queda como extension futura) ──
  registerRelationship(relationship: Relationship) {
    this.relationships.set(relationship.name, relationship)
    this.notify()
  }

  listRelationships(): Relationship[] {
    return Array.from(this.relationships.values())
  }

  // ── Catalogo de campos ─────────────────────────────────────
  getFieldCatalog(): FieldCatalogEntry[] {
    const dimensionEntries: FieldCatalogEntry[] = this.listDimensions().map((d) => ({
      name: d.name,
      label: d.label,
      kind: 'dimension',
      description: d.description,
    }))
    const measureEntries: FieldCatalogEntry[] = this.listMeasures().map((m) => ({
      name: m.name,
      label: m.label,
      kind: 'measure',
      description: m.description,
      isCalculated: m.isCalculated,
    }))
    return [...dimensionEntries, ...measureEntries]
  }

  /** Nombres de otras medidas registradas que esta formula referencia directamente. */
  getDependencies(measureName: string): string[] {
    const measure = this.measures.get(measureName)
    if (!measure) return []
    return this.engine
      .getIdentifiers(measure.expression)
      .filter((id) => id !== measureName && this.measures.has(id))
  }

  private validateMeasure(measure: Measure) {
    const syntaxError = this.engine.validate(measure.expression)
    if (syntaxError) {
      throw new Error(`Formula invalida en "${measure.name}": ${syntaxError}`)
    }

    // Deteccion de ciclos vía DFS, simulando el registro de `measure` sin mutar el modelo real.
    const snapshot = new Map(this.measures)
    snapshot.set(measure.name, measure)
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const visit = (name: string) => {
      if (visiting.has(name)) {
        throw new Error(`Referencia circular detectada en "${name}"`)
      }
      if (visited.has(name)) return
      visiting.add(name)
      const current = snapshot.get(name)
      if (current) {
        for (const id of this.engine.getIdentifiers(current.expression)) {
          if (snapshot.has(id)) visit(id)
        }
      }
      visiting.delete(name)
      visited.add(name)
    }

    visit(measure.name)
  }
}
