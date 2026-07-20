import type { BinaryOp } from './ast'
import { EvalError } from './errors'

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value.length > 0
  return Boolean(value)
}

function isNumeric(value: unknown): boolean {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
}

export function evalBinary(op: BinaryOp, left: unknown, right: unknown): unknown {
  switch (op) {
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        if (!isNumeric(left) || !isNumeric(right)) return String(left ?? '') + String(right ?? '')
      }
      return toNumber(left) + toNumber(right)
    case '-':
      return toNumber(left) - toNumber(right)
    case '*':
      return toNumber(left) * toNumber(right)
    case '/': {
      const divisor = toNumber(right)
      if (divisor === 0) return 0
      return toNumber(left) / divisor
    }
    case '%': {
      const divisor = toNumber(right)
      if (divisor === 0) return 0
      return toNumber(left) % divisor
    }
    case '>':
      return compare(left, right) > 0
    case '<':
      return compare(left, right) < 0
    case '>=':
      return compare(left, right) >= 0
    case '<=':
      return compare(left, right) <= 0
    case '==':
      return looseEquals(left, right)
    case '!=':
      return !looseEquals(left, right)
    default:
      throw new EvalError(`Operador desconocido "${op}"`)
  }
}

function compare(left: unknown, right: unknown): number {
  if (isNumeric(left) && isNumeric(right)) {
    const a = toNumber(left)
    const b = toNumber(right)
    return a < b ? -1 : a > b ? 1 : 0
  }
  const a = String(left ?? '')
  const b = String(right ?? '')
  return a < b ? -1 : a > b ? 1 : 0
}

function looseEquals(left: unknown, right: unknown): boolean {
  if (isNumeric(left) && isNumeric(right)) return toNumber(left) === toNumber(right)
  return String(left ?? '') === String(right ?? '')
}
