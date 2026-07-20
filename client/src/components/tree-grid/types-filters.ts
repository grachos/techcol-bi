/** Tipos para filtros dinámicos en TreeGrid */

export type FilterType = 'text' | 'select' | 'number' | 'dateRange' | 'numberRange'

export interface FilterDefinition {
  /** Nombre de la columna a filtrar */
  field: string
  /** Tipo de filtro a renderizar */
  type: FilterType
  /** Etiqueta opcional para mostrar */
  label?: string
  /** Opciones para filtros de tipo 'select' */
  options?: Array<{ value: string | number; label: string }>
  /** Valor por defecto */
  defaultValue?: any
  /** Placeholder del input */
  placeholder?: string
}

export interface TreeGridFilterState {
  [fieldName: string]: any
}

export interface TreeGridFilterConfig {
  /** Definiciones de filtros disponibles */
  definitions?: FilterDefinition[]
  /** Estado actual de los filtros */
  state?: TreeGridFilterState
  /** Callback cuando cambia un filtro */
  onChange?: (fieldName: string, value: any) => void
  /** Callback para limpiar todos los filtros */
  onClear?: () => void
  /** Permite al usuario agregar/quitar filtros (mostrar panel de administrador) */
  editable?: boolean
}
