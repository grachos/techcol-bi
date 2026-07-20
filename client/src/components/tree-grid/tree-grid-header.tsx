import { useRef } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResolvedTreeGridColumn, SortDirection } from './types'

interface TreeGridHeaderProps<TRow> {
  columns: ResolvedTreeGridColumn<TRow>[]
  gridTemplateColumns: string
  sort: { columnId: string; direction: SortDirection } | null
  onSort: (columnId: string) => void
  onReorder: (draggedId: string, targetId: string) => void
  onResize: (columnId: string, width: number) => void
}

export function TreeGridHeader<TRow>({
  columns,
  gridTemplateColumns,
  sort,
  onSort,
  onReorder,
  onResize,
}: TreeGridHeaderProps<TRow>) {
  const dragId = useRef<string | null>(null)

  return (
    <div
      role='row'
      className='sticky top-0 z-20 grid border-b bg-muted/60 text-xs font-semibold text-muted-foreground backdrop-blur-sm'
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => {
        const isSorted = sort?.columnId === column.id ? sort.direction : null
        return (
          <div
            key={column.id}
            role='columnheader'
            aria-sort={isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : 'none'}
            className={cn(
              'relative flex h-9 min-w-0 select-none items-center gap-1 border-e px-2',
              column.pinned && 'sticky z-30 bg-muted/95',
              column.align === 'right' && 'justify-end',
              column.align === 'center' && 'justify-center'
            )}
            style={{ left: column.stickyLeft, right: column.stickyRight }}
          >
            <span
              draggable
              onDragStart={(e) => {
                dragId.current = column.id
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId.current) onReorder(dragId.current, column.id)
                dragId.current = null
              }}
              className='cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing'
              aria-hidden
            >
              <GripVertical className='size-3.5' />
            </span>

            {column.sortable !== false ? (
              <button
                type='button'
                onClick={() => onSort(column.id)}
                className='flex min-w-0 flex-1 items-center gap-1 truncate text-start hover:text-foreground'
              >
                <span className='truncate'>{column.header}</span>
                {isSorted === 'asc' && <ArrowUp className='size-3 shrink-0' />}
                {isSorted === 'desc' && <ArrowDown className='size-3 shrink-0' />}
                {!isSorted && <ArrowUpDown className='size-3 shrink-0 opacity-30' />}
              </button>
            ) : (
              <span className='min-w-0 flex-1 truncate'>{column.header}</span>
            )}

            <ResizeHandle columnId={column.id} width={column.width} onResize={onResize} />
          </div>
        )
      })}
    </div>
  )
}

function ResizeHandle({
  columnId,
  width,
  onResize,
}: {
  columnId: string
  width: number
  onResize: (columnId: string, width: number) => void
}) {
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    startX.current = e.clientX
    startWidth.current = width

    const handleMove = (ev: PointerEvent) => {
      onResize(columnId, startWidth.current + (ev.clientX - startX.current))
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      className='absolute inset-y-0 -end-1 z-10 w-2 cursor-col-resize touch-none'
      role='separator'
      aria-orientation='vertical'
      aria-label='Redimensionar columna'
    />
  )
}
