export type ColumnDataType = 'text' | 'number' | 'currency' | 'percent' | 'date'
export type ColumnAlign = 'left' | 'center' | 'right'
export type PinSide = 'left' | 'right'
export type SortDirection = 'asc' | 'desc' | null
export type TreeGridState = 'idle' | 'loading' | 'error'

export interface ConditionalRule<TRow = unknown> {
  /** Evalua si la regla aplica; se prueban en orden y gana la primera que retorne true. */
  when: (value: unknown, row: TRow) => boolean
  /** Clases Tailwind aplicadas a la celda cuando la regla aplica. */
  className: string
}

export interface TreeGridColumn<TRow = unknown> {
  id: string
  header: string
  accessor: (row: TRow) => unknown
  type?: ColumnDataType
  align?: ColumnAlign
  width?: number
  minWidth?: number
  maxWidth?: number
  /** Columna fija a la izquierda o derecha del area con scroll horizontal. */
  pinned?: PinSide
  sortable?: boolean
  filterable?: boolean
  /** Puede ocultarse/mostrarse desde el menu "Columnas". Default true. */
  hideable?: boolean
  /** Visibilidad inicial. Default true. */
  visible?: boolean
  currency?: string
  decimals?: number
  /** Agregacion usada en filas de grupo y en la fila de totales. */
  aggregate?: (rows: TRow[]) => unknown
  /** Formato condicional evaluado por fila/valor. */
  rules?: ConditionalRule<TRow>[]
}

export interface ResolvedTreeGridColumn<TRow = unknown> extends TreeGridColumn<TRow> {
  width: number
  stickyLeft?: number
  stickyRight?: number
}

export interface TreeGridGroupLevel<TRow = unknown> {
  id: string
  label: string
  accessor: (row: TRow) => string
}

export interface ColumnFilterValue {
  text?: string
  min?: number
  max?: number
}

export interface FlatRow<TRow = unknown> {
  key: string
  depth: number
  isGroup: boolean
  label?: string
  count?: number
  data?: TRow
  groupRows?: TRow[]
  expanded?: boolean
}
