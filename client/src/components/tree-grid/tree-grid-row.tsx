import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCellValue, resolveConditionalClassName } from './formatters'
import type { FlatRow, ResolvedTreeGridColumn } from './types'

interface TreeGridRowProps<TRow> {
  row: FlatRow<TRow>
  columns: ResolvedTreeGridColumn<TRow>[]
  gridTemplateColumns: string
  onToggle: (key: string) => void
  labelColumnId: string
}

export function TreeGridRow<TRow>({
  row,
  columns,
  gridTemplateColumns,
  onToggle,
  labelColumnId,
}: TreeGridRowProps<TRow>) {
  return (
    <div
      role='row'
      aria-level={row.depth + 1}
      aria-expanded={row.isGroup ? row.expanded : undefined}
      className={cn(
        'grid h-full items-stretch border-b text-xs',
        row.isGroup ? 'bg-muted/40 font-medium hover:bg-muted/60' : 'hover:bg-muted/30'
      )}
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => {
        const isLabelColumn = column.id === labelColumnId

        if (row.isGroup) {
          const value =
            !isLabelColumn && column.aggregate && row.groupRows
              ? column.aggregate(row.groupRows)
              : undefined

          return (
            <div
              key={column.id}
              role='gridcell'
              className={cn(
                'flex min-w-0 items-center overflow-hidden border-e px-2',
                column.pinned && 'sticky z-10 bg-inherit',
                column.align === 'right' && 'justify-end tabular-nums',
                column.align === 'center' && 'justify-center'
              )}
              style={{ left: column.stickyLeft, right: column.stickyRight }}
            >
              {isLabelColumn ? (
                <button
                  type='button'
                  onClick={() => onToggle(row.key)}
                  className='flex min-w-0 items-center gap-1.5 text-start'
                  style={{ paddingInlineStart: row.depth * 16 }}
                >
                  {row.expanded ? (
                    <ChevronDown className='size-3.5 shrink-0 text-muted-foreground' />
                  ) : (
                    <ChevronRight className='size-3.5 shrink-0 text-muted-foreground' />
                  )}
                  <span className='truncate'>{row.label}</span>
                  <span className='shrink-0 font-normal text-muted-foreground'>({row.count})</span>
                </button>
              ) : value !== undefined ? (
                <span
                  className={resolveConditionalClassName(value, row.groupRows?.[0] as TRow, column.rules)}
                >
                  {formatCellValue(value, column)}
                </span>
              ) : null}
            </div>
          )
        }

        const data = row.data as TRow
        const value = column.accessor(data)

        return (
          <div
            key={column.id}
            role='gridcell'
            className={cn(
              'flex min-w-0 items-center overflow-hidden border-e px-2 text-foreground/90',
              column.pinned && 'sticky z-10 bg-background',
              column.align === 'right' && 'justify-end tabular-nums',
              column.align === 'center' && 'justify-center'
            )}
            style={{ left: column.stickyLeft, right: column.stickyRight }}
          >
            <span
              className={cn('truncate', resolveConditionalClassName(value, data, column.rules))}
              style={isLabelColumn ? { paddingInlineStart: row.depth * 16 } : undefined}
              title={typeof value === 'string' ? value : undefined}
            >
              {formatCellValue(value, column)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
