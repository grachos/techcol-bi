import { useMemo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TreeGridFooter } from './tree-grid-footer'
import { TreeGridHeader } from './tree-grid-header'
import { TreeGridRow } from './tree-grid-row'
import { TreeGridToolbar } from './tree-grid-toolbar'
import { TreeGridFilters } from './tree-grid-filters'
import { useTreeGrid } from './use-tree-grid'
import { useTreeGridFilters } from './use-tree-grid-filters'
import type { TreeGridColumn, TreeGridGroupLevel, TreeGridState } from './types'
import type { FilterDefinition } from './types-filters'

export interface TreeGridProps<TRow> {
  columns: TreeGridColumn<TRow>[]
  data: TRow[]
  groupBy?: TreeGridGroupLevel<TRow>[]
  getRowId?: (row: TRow) => string
  state?: TreeGridState
  errorMessage?: string
  emptyMessage?: string
  /** Alto fijo en px del area con scroll. Si se omite, ocupa el alto del contenedor padre (que debe tener una altura definida). */
  height?: number
  rowHeight?: number
  showTotals?: boolean
  totalsLabel?: string
  defaultExpandedDepth?: number
  className?: string
  title?: string
  /** Definiciones de filtros dinámicos */
  filterDefinitions?: FilterDefinition[]
}

const DEFAULT_ROW_HEIGHT = 32

export function TreeGrid<TRow extends Record<string, any>>({
  columns,
  data,
  groupBy = [],
  getRowId,
  state = 'idle',
  errorMessage = 'No se pudieron cargar los datos.',
  emptyMessage = 'No hay resultados para los filtros aplicados.',
  height,
  rowHeight = DEFAULT_ROW_HEIGHT,
  showTotals = true,
  totalsLabel = 'Total',
  defaultExpandedDepth = 1,
  className,
  title,
  filterDefinitions = [],
}: TreeGridProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Gestionar filtros dinámicos
  const {
    activeFilters,
    filterValues,
    handleToggleFilter,
    handleFilterChange,
    handleClearFilters,
    getFilterPredicate,
  } = useTreeGridFilters({ definitions: filterDefinitions })

  // Aplicar filtros dinámicos a los datos
  const filteredData = useMemo(() => {
    if (filterDefinitions.length === 0 || Object.keys(filterValues).length === 0) {
      return data
    }
    return data.filter(getFilterPredicate)
  }, [data, filterDefinitions, filterValues, getFilterPredicate])

  const {
    resolvedColumns,
    flatRows,
    filteredLeafRows,
    filteredLeafCount,
    totalLeafCount,
    sort,
    setSort,
    filters,
    setFilter,
    clearFilters,
    hiddenColumns,
    toggleColumnVisibility,
    reorderColumn,
    setColumnWidth,
    toggleExpand,
  } = useTreeGrid<TRow>({ data: filteredData, columns, groupBy, getRowId, defaultExpandedDepth })

  const labelColumnId = columns[0]?.id ?? ''

  const gridTemplateColumns = useMemo(
    () => resolvedColumns.map((c) => `${c.width}px`).join(' '),
    [resolvedColumns]
  )

  const isLoading = state === 'loading'
  const isError = state === 'error'
  const isEmpty = !isLoading && !isError && flatRows.length === 0

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-background',
        height === undefined && 'h-full',
        className
      )}
    >
      {title && (
        <div className='border-b px-3 py-2'>
          <h3 className='text-sm font-semibold'>{title}</h3>
        </div>
      )}

      {filterDefinitions.length > 0 && (
        <TreeGridFilters
          definitions={filterDefinitions}
          activeFilters={activeFilters}
          filterValues={filterValues}
          onToggleFilter={handleToggleFilter}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      <TreeGridToolbar
        columns={columns}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        hiddenColumns={hiddenColumns}
        onToggleColumnVisibility={toggleColumnVisibility}
        resultCount={filteredLeafCount}
        totalCount={totalLeafCount}
      />

      <div
        ref={scrollRef}
        role='grid'
        aria-rowcount={flatRows.length}
        aria-colcount={resolvedColumns.length}
        className='relative min-w-0 flex-1 min-h-0 overflow-auto'
        style={height !== undefined ? { height } : undefined}
      >
        <TreeGridHeader
          columns={resolvedColumns}
          gridTemplateColumns={gridTemplateColumns}
          sort={sort}
          onSort={setSort}
          onReorder={reorderColumn}
          onResize={setColumnWidth}
        />

        {isLoading && (
          <TreeGridStateOverlay icon={<Loader2 className='size-5 animate-spin' />} text='Cargando datos…' />
        )}
        {isError && (
          <TreeGridStateOverlay
            icon={<AlertTriangle className='size-5 text-destructive' />}
            text={errorMessage}
            tone='error'
          />
        )}
        {isEmpty && <TreeGridStateOverlay icon={<Inbox className='size-5' />} text={emptyMessage} />}

        {!isLoading && !isError && !isEmpty && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = flatRows[virtualRow.index]
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TreeGridRow
                    row={row}
                    columns={resolvedColumns}
                    gridTemplateColumns={gridTemplateColumns}
                    onToggle={toggleExpand}
                    labelColumnId={labelColumnId}
                  />
                </div>
              )
            })}
          </div>
        )}

        {showTotals && !isLoading && !isError && (
          <TreeGridFooter
            columns={resolvedColumns}
            gridTemplateColumns={gridTemplateColumns}
            rows={filteredLeafRows}
            labelColumnId={labelColumnId}
            label={totalsLabel}
          />
        )}
      </div>
    </div>
  )
}

function TreeGridStateOverlay({
  icon,
  text,
  tone = 'default',
}: {
  icon: ReactNode
  text: string
  tone?: 'default' | 'error'
}) {
  return (
    <div className='flex h-64 flex-col items-center justify-center gap-2 text-sm'>
      {icon}
      <p className={cn('text-muted-foreground', tone === 'error' && 'text-destructive')}>{text}</p>
    </div>
  )
}
