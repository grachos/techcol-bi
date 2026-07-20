import type { ASTNode } from './ast'
import { evalBinary, toBoolean, toNumber } from './coerce'
import type { EvalContext, FunctionDef } from './context'
import { EvalError } from './errors'

export function evaluateNode(
  node: ASTNode,
  ctx: EvalContext,
  functions: Map<string, FunctionDef>
): unknown {
  switch (node.type) {
    case 'Number':
      return node.value

    case 'String':
      return node.value

    case 'Identifier': {
      if (ctx.row) return ctx.row[node.name]
      if (!ctx.resolveIdentifier) {
        throw new EvalError(`No se puede resolver "${node.name}" fuera de un contexto de fila`)
      }
      return ctx.resolveIdentifier(node.name)
    }

    case 'Unary': {
      const value = evaluateNode(node.argument, ctx, functions)
      return node.op === '-' ? -toNumber(value) : !toBoolean(value)
    }

    case 'Binary': {
      const left = evaluateNode(node.left, ctx, functions)
      const right = evaluateNode(node.right, ctx, functions)
      return evalBinary(node.op, left, right)
    }

    case 'Logical': {
      const left = toBoolean(evaluateNode(node.left, ctx, functions))
      if (node.op === 'AND') {
        return left && toBoolean(evaluateNode(node.right, ctx, functions))
      }
      return left || toBoolean(evaluateNode(node.right, ctx, functions))
    }

    case 'Call': {
      const def = functions.get(node.name)
      if (!def) throw new EvalError(`Funcion desconocida "${node.name}"`)
      if (node.args.length < def.minArgs || (def.maxArgs != null && node.args.length > def.maxArgs)) {
        throw new EvalError(`Numero de argumentos invalido para ${node.name}()`)
      }
      if (def.isAggregate) {
        return def.evaluate(node.args, ctx, (n, c) => evaluateNode(n, c, functions))
      }
      const argValues = node.args.map((arg) => evaluateNode(arg, ctx, functions))
      return def.evaluate(argValues)
    }

    default: {
      const exhaustive: never = node
      throw new EvalError(`Nodo AST desconocido: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/**
 * Recorre el AST y devuelve los identificadores en contexto de grupo, es
 * decir, los que resuelven a otras medidas/dimensiones. Los identificadores
 * dentro de una funcion de agregacion son referencias a columnas crudas
 * (contexto de fila), no dependencias entre medidas, por lo que NO se
 * recorren cuando se provee `isAggregate` (evita falsos ciclos como
 * "revenue" = SUM(revenue), donde la columna y la medida comparten nombre).
 */
export function extractIdentifiers(
  node: ASTNode,
  acc: Set<string> = new Set(),
  isAggregate?: (name: string) => boolean
): Set<string> {
  switch (node.type) {
    case 'Identifier':
      acc.add(node.name)
      break
    case 'Unary':
      extractIdentifiers(node.argument, acc, isAggregate)
      break
    case 'Binary':
    case 'Logical':
      extractIdentifiers(node.left, acc, isAggregate)
      extractIdentifiers(node.right, acc, isAggregate)
      break
    case 'Call':
      if (isAggregate?.(node.name)) break
      node.args.forEach((arg) => extractIdentifiers(arg, acc, isAggregate))
      break
  }
  return acc
}
