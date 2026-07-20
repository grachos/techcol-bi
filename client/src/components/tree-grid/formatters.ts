import type { TreeGridColumn } from './types'

export function formatCellValue(value: unknown, column: TreeGridColumn<any>): string {
  if (value === null || value === undefined || value === '') return '—'
  const type = column.type ?? 'text'

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: column.currency ?? 'USD',
        maximumFractionDigits: column.decimals ?? 0,
      }).format(Number(value))
    case 'percent':
      return new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: column.decimals ?? 1,
        maximumFractionDigits: column.decimals ?? 1,
      }).format(Number(value))
    case 'number':
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: column.decimals ?? 0,
      }).format(Number(value))
    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value))
      return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
    }
    default:
      return String(value)
  }
}

export function resolveConditionalClassName<TRow>(
  value: unknown,
  row: TRow,
  rules?: TreeGridColumn<TRow>['rules']
): string {
  if (!rules) return ''
  for (const rule of rules) {
    if (rule.when(value, row)) return rule.className
  }
  return ''
}
