import { useState, useCallback } from 'react'
import type { FilterDefinition, TreeGridFilterState } from './types-filters'

interface UseTreeGridFiltersProps {
  definitions?: FilterDefinition[]
  onFiltersChange?: (filters: TreeGridFilterState, activeFields: string[]) => void
}

export function useTreeGridFilters({ definitions = [], onFiltersChange }: UseTreeGridFiltersProps) {
  // Filtros activos: lista de fields que están habilitados
  const [activeFilters, setActiveFilters] = useState<string[]>(() => {
    // Por defecto, todos los filtros están activos si no hay definiciones con defaultValue
    return definitions
      .filter((d) => d.defaultValue !== undefined)
      .map((d) => d.field)
  })

  // Valores actuales de los filtros
  const [filterValues, setFilterValues] = useState<TreeGridFilterState>(() => {
    const initial: TreeGridFilterState = {}
    definitions.forEach((d) => {
      if (d.defaultValue !== undefined) {
        initial[d.field] = d.defaultValue
      }
    })
    return initial
  })

  const handleToggleFilter = useCallback((fieldName: string) => {
    setActiveFilters((prev) => {
      const next = prev.includes(fieldName)
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]

      setFilterValues((vals) => {
        const newVals = { ...vals }
        if (!next.includes(fieldName)) {
          delete newVals[fieldName]
        } else if (!(fieldName in newVals)) {
          newVals[fieldName] = null
        }
        onFiltersChange?.(newVals, next)
        return newVals
      })

      return next
    })
  }, [onFiltersChange])

  const handleFilterChange = useCallback(
    (fieldName: string, value: any) => {
      setFilterValues((prev) => {
        const next = { ...prev, [fieldName]: value }
        onFiltersChange?.(next, activeFilters)
        return next
      })
    },
    [activeFilters, onFiltersChange]
  )

  const handleClearFilters = useCallback(() => {
    setFilterValues({})
    // No limpiamos activeFilters, solo vaciamos los valores
    onFiltersChange?.({}, activeFilters)
  }, [activeFilters, onFiltersChange])

  // Función para convertir los filtros en un predicado que aplique a filas
  const getFilterPredicate = useCallback(
    (row: Record<string, any>) => {
      for (const [fieldName, value] of Object.entries(filterValues)) {
        if (value === null || value === undefined || value === '') {
          continue
        }

        const fieldValue = row[fieldName]
        const def = definitions.find((d) => d.field === fieldName)

        if (!def) continue

        switch (def.type) {
          case 'text':
            if (
              !String(fieldValue)
                .toLowerCase()
                .includes(String(value).toLowerCase())
            ) {
              return false
            }
            break

          case 'number':
            if (Number(fieldValue) !== Number(value)) {
              return false
            }
            break

          case 'numberRange':
            if (value.min !== null && Number(fieldValue) < Number(value.min)) {
              return false
            }
            if (value.max !== null && Number(fieldValue) > Number(value.max)) {
              return false
            }
            break

          case 'dateRange':
            if (value.from) {
              const fieldDate = new Date(String(fieldValue))
              const fromDate = new Date(value.from)
              if (fieldDate < fromDate) {
                return false
              }
            }
            if (value.to) {
              const fieldDate = new Date(String(fieldValue))
              const toDate = new Date(value.to)
              toDate.setHours(23, 59, 59, 999)
              if (fieldDate > toDate) {
                return false
              }
            }
            break

          case 'select':
            if (String(fieldValue) !== String(value)) {
              return false
            }
            break
        }
      }

      return true
    },
    [filterValues, definitions]
  )

  return {
    activeFilters,
    filterValues,
    handleToggleFilter,
    handleFilterChange,
    handleClearFilters,
    getFilterPredicate,
  }
}
