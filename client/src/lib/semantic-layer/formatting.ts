import type { FormatSpec } from './types'

export function applyFormat(value: unknown, format?: FormatSpec): string {
  if (value === null || value === undefined || value === '') return '—'

  const type = format?.type ?? 'number'
  let formatted: string

  switch (type) {
    case 'currency':
      formatted = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: format?.currency ?? 'USD',
        maximumFractionDigits: format?.decimals ?? 0,
      }).format(Number(value))
      break
    case 'percent':
      formatted = new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: format?.decimals ?? 1,
        maximumFractionDigits: format?.decimals ?? 1,
      }).format(Number(value))
      break
    case 'number':
      formatted = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: format?.decimals ?? 0,
      }).format(Number(value))
      break
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
