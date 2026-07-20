import { toBoolean, toNumber } from './coerce'
import type { AggregateFunctionDef, FunctionDef, ScalarFunctionDef } from './context'
import { EvalError } from './errors'

function aggregate(def: Omit<AggregateFunctionDef, 'isAggregate'>): AggregateFunctionDef {
  return { ...def, isAggregate: true }
}

function scalar(def: Omit<ScalarFunctionDef, 'isAggregate'>): ScalarFunctionDef {
  return { ...def, isAggregate: false }
}

const SUM = aggregate({
  name: 'SUM',
  minArgs: 1,
  maxArgs: 1,
  description: 'Suma la expresion evaluada para cada fila del grupo.',
  evaluate: (argsAst, ctx, evaluateNode) =>
    ctx.rows.reduce((total, row) => total + toNumber(evaluateNode(argsAst[0], { ...ctx, row })), 0),
})

const AVG = aggregate({
  name: 'AVG',
  minArgs: 1,
  maxArgs: 1,
  description: 'Promedio de la expresion evaluada para cada fila del grupo.',
  evaluate: (argsAst, ctx, evaluateNode) => {
    if (ctx.rows.length === 0) return 0
    const total = ctx.rows.reduce((sum, row) => sum + toNumber(evaluateNode(argsAst[0], { ...ctx, row })), 0)
    return total / ctx.rows.length
  },
})

const MIN = aggregate({
  name: 'MIN',
  minArgs: 1,
  maxArgs: 1,
  description: 'Valor minimo de la expresion en el grupo.',
  evaluate: (argsAst, ctx, evaluateNode) => {
    const values = ctx.rows.map((row) => toNumber(evaluateNode(argsAst[0], { ...ctx, row })))
    return values.length === 0 ? 0 : Math.min(...values)
  },
})

const MAX = aggregate({
  name: 'MAX',
  minArgs: 1,
  maxArgs: 1,
  description: 'Valor maximo de la expresion en el grupo.',
  evaluate: (argsAst, ctx, evaluateNode) => {
    const values = ctx.rows.map((row) => toNumber(evaluateNode(argsAst[0], { ...ctx, row })))
    return values.length === 0 ? 0 : Math.max(...values)
  },
})

const COUNT = aggregate({
  name: 'COUNT',
  minArgs: 0,
  maxArgs: 1,
  description: 'Cuenta filas del grupo, o filas donde la expresion no es nula si se pasa un argumento.',
  evaluate: (argsAst, ctx, evaluateNode) => {
    if (argsAst.length === 0) return ctx.rows.length
    return ctx.rows.filter((row) => {
      const value = evaluateNode(argsAst[0], { ...ctx, row })
      return value !== null && value !== undefined && value !== ''
    }).length
  },
})

const DISTINCTCOUNT = aggregate({
  name: 'DISTINCTCOUNT',
  minArgs: 1,
  maxArgs: 1,
  description: 'Cuenta valores distintos no nulos de la expresion en el grupo.',
  evaluate: (argsAst, ctx, evaluateNode) => {
    const seen = new Set<string>()
    for (const row of ctx.rows) {
      const value = evaluateNode(argsAst[0], { ...ctx, row })
      if (value === null || value === undefined || value === '') continue
      seen.add(String(value))
    }
    return seen.size
  },
})

const IF = scalar({
  name: 'IF',
  minArgs: 3,
  maxArgs: 3,
  description: 'IF(condicion, valorSiVerdadero, valorSiFalso)',
  evaluate: ([condition, whenTrue, whenFalse]) => (toBoolean(condition) ? whenTrue : whenFalse),
})

const ABS = scalar({
  name: 'ABS',
  minArgs: 1,
  maxArgs: 1,
  description: 'Valor absoluto.',
  evaluate: ([value]) => Math.abs(toNumber(value)),
})

const ROUND = scalar({
  name: 'ROUND',
  minArgs: 1,
  maxArgs: 2,
  description: 'ROUND(valor, decimales?)',
  evaluate: ([value, decimals]) => {
    const factor = 10 ** toNumber(decimals ?? 0)
    return Math.round(toNumber(value) * factor) / factor
  },
})

const COALESCE = scalar({
  name: 'COALESCE',
  minArgs: 1,
  maxArgs: null,
  description: 'Retorna el primer argumento no nulo.',
  evaluate: (args) => {
    for (const value of args) {
      if (value !== null && value !== undefined && value !== '') return value
    }
    return null
  },
})

const CONCAT = scalar({
  name: 'CONCAT',
  minArgs: 2,
  maxArgs: null,
  description: 'CONCAT(valor1, valor2, ...) — une varios valores en un solo texto.',
  evaluate: (args) => args.map((v) => (v === null || v === undefined ? '' : String(v))).join(''),
})

// Fechas "solo fecha" (ej. "2026-06-01", sin hora) se parsean por spec ISO
// como medianoche UTC -- pero YEAR/MONTH/DAY leen con getters LOCALES
// (getMonth/getDate/getFullYear). En cualquier zona horaria detras de UTC,
// esto corre el dia (y a veces el mes) un dia hacia atras: "2026-06-01"
// vuelve "31 de mayo" localmente, y MONTH() devuelve 5 en vez de 6. Se
// arma la fecha con el constructor de componentes (year, month, day), que
// interpreta los numeros directamente en hora local sin pasar por UTC.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const str = String(value)
  const dateOnlyMatch = str.match(DATE_ONLY_RE)
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? null : d
}

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MONTH_ABBR_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const YEAR = scalar({
  name: 'YEAR',
  minArgs: 1,
  maxArgs: 2,
  description: 'YEAR(fecha, [formato]) — extrae el año. formato "YY" da 2 dígitos (26); sin formato, año completo (2026).',
  evaluate: ([value, format]) => {
    const d = toDate(value)
    if (!d) return 0
    const year = d.getFullYear()
    return String(format ?? '').toUpperCase() === 'YY' ? year % 100 : year
  },
})

const MONTH = scalar({
  name: 'MONTH',
  minArgs: 1,
  maxArgs: 2,
  description:
    'MONTH(fecha, [formato]) — extrae el mes. "M" (default) = 1-12, "MM" = 01-12, "MMM" = abreviado (jun), "MMMM" = nombre completo (Junio).',
  evaluate: ([value, format]) => {
    const d = toDate(value)
    if (!d) return 0
    const monthIndex = d.getMonth()
    switch (String(format ?? 'M').toUpperCase()) {
      case 'MM':
        return String(monthIndex + 1).padStart(2, '0')
      case 'MMM':
        return capitalize(MONTH_ABBR_ES[monthIndex])
      case 'MMMM':
        return capitalize(MONTH_NAMES_ES[monthIndex])
      default:
        return monthIndex + 1
    }
  },
})

const DAY = scalar({
  name: 'DAY',
  minArgs: 1,
  maxArgs: 2,
  description: 'DAY(fecha, [formato]) — extrae el día. formato "DD" da 2 dígitos (01-31); sin formato, sin relleno (1-31).',
  evaluate: ([value, format]) => {
    const d = toDate(value)
    if (!d) return 0
    const day = d.getDate()
    return String(format ?? '').toUpperCase() === 'DD' ? String(day).padStart(2, '0') : day
  },
})

const UPPER = scalar({
  name: 'UPPER',
  minArgs: 1,
  maxArgs: 1,
  description: 'UPPER(texto) — convierte a mayúsculas.',
  evaluate: ([value]) => String(value ?? '').toUpperCase(),
})

const LOWER = scalar({
  name: 'LOWER',
  minArgs: 1,
  maxArgs: 1,
  description: 'LOWER(texto) — convierte a minúsculas.',
  evaluate: ([value]) => String(value ?? '').toLowerCase(),
})

const BUILTIN_FUNCTIONS: FunctionDef[] = [
  SUM,
  AVG,
  MIN,
  MAX,
  COUNT,
  DISTINCTCOUNT,
  IF,
  ABS,
  ROUND,
  COALESCE,
  CONCAT,
  YEAR,
  MONTH,
  DAY,
  UPPER,
  LOWER,
]

export function createDefaultFunctionRegistry(): Map<string, FunctionDef> {
  const registry = new Map<string, FunctionDef>()
  for (const def of BUILTIN_FUNCTIONS) registry.set(def.name, def)
  return registry
}

export function assertValidFunctionDef(def: FunctionDef) {
  if (!def.name || !/^[A-Z][A-Z0-9_]*$/.test(def.name)) {
    throw new EvalError(`Nombre de funcion invalido: "${def.name}"`)
  }
}
