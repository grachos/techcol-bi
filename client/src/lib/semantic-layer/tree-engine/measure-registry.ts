import { ExpressionEngine } from '../expression'
import type { MeasureDef, MeasureKind } from './types'

/**
 * Registro de medidas para el motor de arbol jerarquico. A diferencia de
 * SemanticModel (que trabaja con formulas planas sobre un solo grupo de
 * filas), aqui cada medida declara explicitamente su `kind` (simple/leaf/
 * derived), y el registro valida que las dependencias entre medidas respeten
 * las reglas de grano -- la regla que faltaba y que producia el bug de
 * "Margen" recalculado mal en los nodos padre.
 */
export class MeasureRegistry {
  private readonly measures = new Map<string, MeasureDef>()
  private readonly engine: ExpressionEngine
  // buildAggregationTree llama evaluationOrder() en CADA nodo del arbol (miles
  // a decenas de miles en un dataset ancho como Silog); sin cache, cada
  // llamada rehace el sort topologico completo (Map/Set/closures nuevos) --
  // trabajo identico repetido, porque el registro no cambia durante la
  // construccion de un arbol. El cache se invalida solo si se registra algo
  // nuevo (no deberia pasar a mitad de un build, pero es gratis ser correcto).
  private orderCache: MeasureDef[] | null = null

  constructor(engine?: ExpressionEngine) {
    this.engine = engine ?? new ExpressionEngine()
  }

  getExpressionEngine(): ExpressionEngine {
    return this.engine
  }

  register(def: MeasureDef) {
    this.validate(def)
    this.measures.set(def.name, def)
    this.orderCache = null
  }

  get(name: string): MeasureDef | undefined {
    return this.measures.get(name)
  }

  has(name: string): boolean {
    return this.measures.has(name)
  }

  all(): MeasureDef[] {
    return Array.from(this.measures.values())
  }

  /**
   * Reglas de grano entre tipos de medida (evita que el bug de "Margen"
   * vuelva a colarse por otra formula):
   *  - simple: no depende de otras medidas.
   *  - leaf: solo puede depender de medidas `simple` (o columnas crudas) --
   *    nunca de otra `leaf`/`derived`, porque esas no estan definidas al
   *    grano de la hoja de forma consistente.
   *  - derived: puede depender de `simple`, `leaf` u otra `derived` (con
   *    deteccion de ciclos), porque a nivel de evaluacion todas ya estan
   *    resueltas como valores del nodo actual.
   */
  private validate(def: MeasureDef) {
    if (def.kind !== 'simple') {
      const syntaxError = this.engine.validate(def.expression)
      if (syntaxError) {
        throw new Error(`Formula invalida en "${def.name}": ${syntaxError}`)
      }
    }

    const snapshot = new Map(this.measures)
    snapshot.set(def.name, def)

    if (def.kind === 'simple') return

    const deps = this.engine
      .getIdentifiers(def.expression)
      .filter((id) => id !== def.name && snapshot.has(id))

    for (const depName of deps) {
      const dep = snapshot.get(depName)!
      if (def.kind === 'leaf' && dep.kind !== 'simple') {
        throw new Error(
          `"${def.name}" es una metrica de hoja (leaf) y solo puede usar medidas "simple" o columnas crudas en su formula; ` +
            `"${depName}" es de tipo "${dep.kind}". Si necesitas combinarlas, hazlo con una metrica "derived" en vez de "leaf".`
        )
      }
    }

    if (def.kind === 'derived') {
      this.assertNoCycles(def, snapshot)
    }
  }

  private assertNoCycles(def: MeasureDef, snapshot: Map<string, MeasureDef>) {
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const visit = (name: string) => {
      if (visiting.has(name)) {
        throw new Error(`Referencia circular detectada en "${name}"`)
      }
      if (visited.has(name)) return
      const current = snapshot.get(name)
      if (!current || current.kind !== 'derived') {
        visited.add(name)
        return
      }
      visiting.add(name)
      for (const id of this.engine.getIdentifiers(current.expression)) {
        if (snapshot.has(id)) visit(id)
      }
      visiting.delete(name)
      visited.add(name)
    }

    visit(def.name)
  }

  /**
   * Orden de evaluacion dentro de un nodo: simple -> leaf -> derived, y
   * dentro de cada tipo, por dependencias (topologico). Simple siempre
   * primero porque no depende de nada; leaf solo depende de simple; derived
   * puede depender de cualquiera, incluida otra derived.
   */
  evaluationOrder(): MeasureDef[] {
    if (this.orderCache) return this.orderCache

    const kindRank: Record<MeasureKind, number> = { simple: 0, leaf: 1, derived: 2 }
    const byName = new Map(this.all().map((m) => [m.name, m]))
    const visited = new Set<string>()
    const order: MeasureDef[] = []

    const visit = (def: MeasureDef) => {
      if (visited.has(def.name)) return
      visited.add(def.name)
      if (def.kind !== 'simple') {
        for (const id of this.engine.getIdentifiers(def.expression)) {
          const dep = byName.get(id)
          if (dep) visit(dep)
        }
      }
      order.push(def)
    }

    for (const def of [...this.all()].sort((a, b) => kindRank[a.kind] - kindRank[b.kind])) {
      visit(def)
    }
    this.orderCache = order
    return order
  }
}
