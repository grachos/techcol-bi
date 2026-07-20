import type { ASTNode } from './ast'

export type Row = Record<string, unknown>

/**
 * Contexto de evaluacion. `row` presente = contexto de fila (dentro de una
 * funcion de agregacion, los identificadores resuelven contra esa fila).
 * `row` ausente = contexto de grupo (los identificadores resuelven medidas
 * o dimensiones via `resolveIdentifier`, provisto por el Query Engine).
 */
export interface EvalContext {
  rows: Row[]
  row?: Row
  resolveIdentifier?: (name: string) => unknown
}

export type EvaluateFn = (node: ASTNode, ctx: EvalContext) => unknown

interface FunctionDefBase {
  name: string
  minArgs: number
  maxArgs: number | null
  description?: string
}

export interface AggregateFunctionDef extends FunctionDefBase {
  isAggregate: true
  evaluate: (argsAst: ASTNode[], ctx: EvalContext, evaluateNode: EvaluateFn) => unknown
}

export interface ScalarFunctionDef extends FunctionDefBase {
  isAggregate: false
  evaluate: (args: unknown[]) => unknown
}

export type FunctionDef = AggregateFunctionDef | ScalarFunctionDef
