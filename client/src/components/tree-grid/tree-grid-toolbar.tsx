import { Columns3, RotateCcw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { ColumnFilterValue, TreeGridColumn } from './types'

interface TreeGridToolbarProps<TRow> {
  columns: TreeGridColumn<TRow>[]
  filters: Record<string, ColumnFilterValue>
  onFilterChange: (columnId: string, value: ColumnFilterValue) => void
  onClearFilters: () => void
  hiddenColumns: Set<string>
  onToggleColumnVisibility: (columnId: string) => void
  resultCount: number
  totalCount: number
}

export function TreeGridToolbar<TRow>({
  columns,
  filters,
  onFilterChange,
  onClearFilters,
  hiddenColumns,
  onToggleColumnVisibility,
  resultCount,
  totalCount,
}: TreeGridToolbarProps<TRow>) {
  const filterableColumns = columns.filter((c) => c.filterable !== false)
  const hasActiveFilters = Object.values(filters).some(
    (v) => v && (v.text || v.min != null || v.max != null)
  )

  return (
    <div className='flex flex-wrap items-end gap-2 border-b bg-background px-3 py-2'>
      {filterableColumns.map((column) => {
        const value = filters[column.id] ?? {}
        const isNumeric =
          column.type === 'number' || column.type === 'currency' || column.type === 'percent'

        return (
          <div key={column.id} className='flex flex-col gap-1'>
            <span className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>
              {column.header}
            </span>
            {isNumeric ? (
              <div className='flex items-center gap-1'>
                <Input
                  type='number'
                  placeholder='Min'
                  value={value.min ?? ''}
                  onChange={(e) =>
                    onFilterChange(column.id, {
                      ...value,
                      min: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className='h-7 w-20 text-xs'
                />
                <span className='text-xs text-muted-foreground'>–</span>
                <Input
                  type='number'
                  placeholder='Max'
                  value={value.max ?? ''}
                  onChange={(e) =>
                    onFilterChange(column.id, {
                      ...value,
                      max: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className='h-7 w-20 text-xs'
                />
              </div>
            ) : (
              <div className='relative'>
                <Search className='pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={value.text ?? ''}
                  onChange={(e) => onFilterChange(column.id, { ...value, text: e.target.value })}
                  placeholder='Filtrar…'
                  className='h-7 w-36 ps-7 text-xs'
                />
              </div>
            )}
          </div>
        )
      })}

      <div className='ms-auto flex items-center gap-2 self-center'>
        <Badge variant='outline' className='text-[10px] font-normal'>
          {resultCount.toLocaleString()} / {totalCount.toLocaleString()}
        </Badge>

        {hasActiveFilters && (
          <Button variant='ghost' size='sm' className='h-7 gap-1 text-xs' onClick={onClearFilters}>
            <RotateCcw className='size-3.5' />
            Limpiar
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' className='h-7 gap-1 text-xs'>
              <Columns3 className='size-3.5' />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-52'>
            <DropdownMenuLabel className='text-xs'>Mostrar/ocultar</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns
              .filter((c) => c.hideable !== false)
              .map((c) => (
                <label
                  key={c.id}
                  className='flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent'
                >
                  <Checkbox
                    checked={!hiddenColumns.has(c.id)}
                    onCheckedChange={() => onToggleColumnVisibility(c.id)}
                  />
                  {c.header}
                </label>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
