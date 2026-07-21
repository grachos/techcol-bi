import type { FormatSpec } from './types'

// Intl.NumberFormat es CARO de construir (carga datos de locale/ICU) y es
// inmutable/reusable para las mismas opciones -- crear uno nuevo en cada
// llamada (como hacia antes este archivo) es el anti-patron clasico de JS.
// En un arbol de agregacion con decenas de miles de nodos, applyFormat() se
// llama una vez por medida por nodo: sin cache eso fueron medidos en ~7s de
// las ~8s totales de construir el arbol -- el cuello de botella real, no la
// logica de agregacion en si.
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, options)
    formatterCache.set(key, formatter)
  }
  return formatter
}

export function applyFormat(value: unknown, format?: FormatSpec): string {
  if (value === null || value === undefined || value === '') return '—'

  const type = format?.type ?? 'number'
  let formatted: string

  switch (type) {
    case 'currency': {
      const currency = format?.currency ?? 'USD'
      const decimals = format?.decimals ?? 0
      formatted = getFormatter(`currency:${currency}:${decimals}`, {
        style: 'currency',
        currency,
        maximumFractionDigits: decimals,
      }).format(Number(value))
      break
    }
    case 'percent': {
      const decimals = format?.decimals ?? 1
      formatted = getFormatter(`percent:${decimals}`, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(Number(value))
      break
    }
    case 'number': {
      const decimals = format?.decimals ?? 0
      formatted = getFormatter(`number:${decimals}`, {
        maximumFractionDigits: decimals,
      }).format(Number(value))
      break
    }
    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value))
      formatted = Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
      break
    }
    default:
      formatted = String(value)
  }

  if (format?.prefix) formatted = format.prefix + formatted
  if (format?.suffix) formatted = formatted + format.suffix
  return formatted
}
