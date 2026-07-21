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
 * Cierre transitivo de dependencias de un conjunto de medidas: una medida
 * 'derived' referencia otras por nombre (ej. "rentabilidad" = margen/total),
 * y esas dependencias tienen que estar en el registro para que se puedan
 * resolver -- pero no hace falta nada mas alla de eso.
 */
function measureClosure(model: SemanticModel, names: Iterable<string>): Set<string> {
  const closure = new Set<string>()
  const visit = (name: string) => {
    if (closure.has(name) || !model.getMeasure(name)) return
    closure.add(name)
    for (const dep of model.getDependencies(name)) visit(dep)
  }
  for (const name of names) visit(name)
  return closure
}

/**
 * Construye un MeasureRegistry con las medidas de un SemanticModel (reusa su
 * mismo ExpressionEngine, para que funciones registradas ahi tambien esten
 * disponibles). Una medida que ya no valida (ej. referencia a otra medida
 * borrada, o una dependencia de grano invalida) se omite en vez de romper el
 * arbol completo -- se avisa por consola para depurar.
 *
 * `onlyNames`: si se da, solo se registran esas medidas + su cierre de
 * dependencias -- NO todas las del modelo. El motor de arbol evalua TODAS
 * las medidas del registro en CADA nodo (ver build-tree.ts computeMetrics);
 * un modelo auto-inferido de una fuente ancha (ej. Silog, ~30 columnas
 * numericas -> ~30 medidas SUM) sin este filtro evalua las ~30 aunque el
 * widget solo pida 1 o 2, multiplicado por miles de nodos del arbol -- el
 * cuello de botella real de un dashboard "lento al cambiar un widget".
 */
export function buildRegistryFromModel(
  model: SemanticModel,
  onlyNames?: Iterable<string>
): MeasureRegistry {
  const registry = new MeasureRegistry(model.getExpressionEngine())
  const wanted = onlyNames ? measureClosure(model, onlyNames) : null
  for (const measure of model.listMeasures()) {
    if (wanted && !wanted.has(measure.name)) continue
    try {
      registry.register(measureToDef(measure))
    } catch (error) {
      console.warn(`No se pudo registrar la medida "${measure.name}" en el arbol:`, error)
    }
  }
  return registry
}
