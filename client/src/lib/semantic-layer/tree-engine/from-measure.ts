import type { SemanticModel } from '../semantic-model'
import type { Measure } from '../types'
import { MeasureRegistry } from './measure-registry'
import type { MeasureDef, SimpleMeasureDef } from './types'

/**
 * Las medidas base auto-inferidas (connector-model.ts) siempre tienen la
 * forma "SUM(campo)" o "COUNT()" -- se reconocen por patron para tratarlas
 * como 'simple' (distributivas) en el motor de arbol, en vez de recalcular
 * la formula en cada nodo via el motor de expresiones plano.
 */
function inferSimpleFromExpression(
  expression: string
): { aggregation: SimpleMeasureDef['aggregation']; column: string | null } | null {
  const match = expression.trim().match(/^(SUM|COUNT|MIN|MAX|DISTINCTCOUNT)\(\s*([^)]*)\s*\)$/i)
  if (!match) return null
  return {
    aggregation: match[1].toLowerCase() as SimpleMeasureDef['aggregation'],
    column: match[2].trim() || null,
  }
}

/**
 * Adapta una `Measure` del modelo semantico plano (SemanticModel) a un
 * `MeasureDef` del motor de arbol jerarquico. Medidas base (no calculadas)
 * se tratan como 'simple' cuando su formula es una agregacion reconocible;
 * medidas calculadas usan `measure.treeKind` (default 'derived', el
 * comportamiento historico) para decidir la estrategia.
 */
export function measureToDef(measure: Measure): MeasureDef {
  if (!measure.isCalculated) {
    const simple = inferSimpleFromExpression(measure.expression)
    if (simple) {
      return {
        kind: 'simple',
        name: measure.name,
        label: measure.label,
        format: measure.format,
        description: measure.description,
        column: simple.column,
        aggregation: simple.aggregation,
      }
    }
  }

  if (measure.treeKind === 'leaf') {
    return {
      kind: 'leaf',
      name: measure.name,
      label: measure.label,
      format: measure.format,
      description: measure.description,
      expression: measure.expression,
      combinator: measure.combinator,
    }
  }

  return {
    kind: 'derived',
    name: measure.name,
    label: measure.label,
    format: measure.format,
    description: measure.description,
    expression: measure.expression,
  }
}

/**
 * Construye un MeasureRegistry con todas las medidas de un SemanticModel
 * (reusa su mismo ExpressionEngine, para que funciones registradas ahi
 * tambien esten disponibles). Una medida que ya no valida (ej. referencia a
 * otra medida borrada, o una dependencia de grano invalida) se omite en vez
 * de romper el arbol completo -- se avisa por consola para depurar.
 */
export function buildRegistryFromModel(model: SemanticModel): MeasureRegistry {
  const registry = new MeasureRegistry(model.getExpressionEngine())
  for (const measure of model.listMeasures()) {
    try {
      registry.register(measureToDef(measure))
    } catch (error) {
      console.warn(`No se pudo registrar la medida "${measure.name}" en el arbol:`, error)
    }
  }
  return registry
}
