import { cn } from '@/lib/utils'
import { formatCellValue } from './formatters'
import type { ResolvedTreeGridColumn } from './types'

interface TreeGridFooterProps<TRow> {
  columns: ResolvedTreeGridColumn<TRow>[]
  gridTemplateColumns: string
  rows: TRow[]
  labelColumnId: string
  label: string
}

export function TreeGridFooter<TRow>({
  columns,
  gridTemplateColumns,
  rows,
  labelColumnId,
  label,
}: TreeGridFooterProps<TRow>) {
  return (
    <div
      role='row'
      className='sticky bottom-0 z-20 grid border-t-2 bg-muted/80 text-xs font-semibold backdrop-blur-sm'
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => {
        const isLabelColumn = column.id === labelColumnId
        const value = column.aggregate ? column.aggregate(rows) : undefined

        return (
          <div
            key={column.id}
            role='gridcell'
            className={cn(
              'flex h-9 min-w-0 items-center overflow-hidden border-e px-2',
              column.pinned && 'sticky z-10 bg-muted/95',
              column.align === 'right' && 'justify-end tabular-nums',
              column.align === 'center' && 'justify-center'
            )}
            style={{ left: column.stickyLeft, right: column.stickyRight }}
          >
            {isLabelColumn ? (
              <span className='truncate'>{label}</span>
            ) : value !== undefined ? (
              <span className='truncate'>{formatCellValue(value, column)}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
