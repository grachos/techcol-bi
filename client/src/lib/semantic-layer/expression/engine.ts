import type { ASTNode } from './ast'
import type { EvalContext, FunctionDef } from './context'
import { assertValidFunctionDef, createDefaultFunctionRegistry } from './functions'
import { evaluateNode, extractIdentifiers } from './evaluator'
import { parseExpression } from './parser'

/**
 * Motor de expresiones reutilizable: parsea (con cache por texto) y evalua
 * formulas contra un EvalContext. Las funciones son un registro pluggable
 * (registerFunction) para agregar nuevas sin tocar el core.
 */
export class ExpressionEngine {
  private functions: Map<string, FunctionDef>
  private astCache = new Map<string, ASTNode>()

  constructor(functions?: Map<string, FunctionDef>) {
    this.functions = functions ?? createDefaultFunctionRegistry()
  }

  registerFunction(def: FunctionDef) {
    assertValidFunctionDef(def)
    this.functions.set(def.name, def)
  }

  hasFunction(name: string): boolean {
    return this.functions.has(name.toUpperCase())
  }

  listFunctions(): FunctionDef[] {
    return Array.from(this.functions.values())
  }

  parse(expression: string): ASTNode {
    const cached = this.astCache.get(expression)
    if (cached) return cached
    const ast = parseExpression(expression)
    this.astCache.set(expression, ast)
    return ast
  }

  /** Valida la sintaxis sin evaluar; retorna el mensaje de error o null si es valida. */
  validate(expression: string): string | null {
    try {
      this.parse(expression)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  evaluate(expression: string, ctx: EvalContext): unknown {
    const ast = this.parse(expression)
    return evaluateNode(ast, ctx, this.functions)
  }

  evaluateAst(ast: ASTNode, ctx: EvalContext): unknown {
    return evaluateNode(ast, ctx, this.functions)
  }

  /**
   * Nombres de identificadores en contexto de grupo (dependencias entre
   * medidas). Los identificadores dentro de funciones de agregacion se
   * excluyen: son columnas crudas, no medidas.
   */
  getIdentifiers(expression: string): string[] {
    const isAggregate = (name: string) => {
      const def = this.functions.get(name.toUpperCase())
      return def?.isAggregate === true
    }
    return Array.from(extractIdentifiers(this.parse(expression), new Set(), isAggregate))
  }

  /**
   * TODOS los identificadores de una formula, incluidos los que estan dentro
   * de una funcion de agregacion (a diferencia de getIdentifiers, que los
   * excluye porque alli son columnas crudas, no dependencias entre medidas).
   * Sirve para saber que columnas/medidas toca una formula sin importar el
   * contexto -- ej. para proyectar solo las columnas necesarias en una
   * consulta en vez de traer la fuente completa.
   */
  getAllIdentifiers(expression: string): string[] {
    return Array.from(extractIdentifiers(this.parse(expression)))
  }

  /**
   * true si la formula NO usa ninguna funcion de agregacion (SUM, AVG, etc.):
   * puede evaluarse fila por fila (ej. CONCAT(origen, destino)), a diferencia
   * de una medida como SUM(revenue) que solo tiene sentido sobre un grupo.
   * Se usa para decidir que medidas se ofrecen como columna de agrupar/filtrar.
   */
  isRowScalar(expression: string): boolean {
    const usesAggregate = (node: ASTNode): boolean => {
      switch (node.type) {
        case 'Call': {
          const def = this.functions.get(node.name)
          if (def?.isAggregate) return true
          return node.args.some(usesAggregate)
        }
        case 'Unary':
          return usesAggregate(node.argument)
        case 'Binary':
        case 'Logical':
          return usesAggregate(node.left) || usesAggregate(node.right)
        default:
          return false
      }
    }
    try {
      return !usesAggregate(this.parse(expression))
    } catch {
      return false
    }
  }
}
