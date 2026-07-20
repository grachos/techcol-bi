import type { ColumnDataType, ColumnFilterValue } from './types'

export function applyColumnFilter(
  value: unknown,
  filter: ColumnFilterValue,
  type: ColumnDataType
): boolean {
  if (type === 'number' || type === 'currency' || type === 'percent') {
    const num = Number(value)
    if (filter.min != null && num < filter.min) return false
    if (filter.max != null && num > filter.max) return false
    return true
  }

  if (type === 'date') {
    const time = new Date(String(value)).getTime()
    if (filter.min != null && time < filter.min) return false
    if (filter.max != null && time > filter.max) return false
    return true
  }

  if (filter.text) {
    return String(value ?? '').toLowerCase().includes(filter.text.toLowerCase())
  }

  return true
}

export function isFilterActive(filter: ColumnFilterValue | undefined): boolean {
  if (!filter) return false
  return Boolean(filter.text) || filter.min != null || filter.max != null
}
