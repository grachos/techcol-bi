import { useState } from 'react'
import { X, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FilterDefinition, TreeGridFilterState } from './types-filters'

interface TreeGridFiltersProps {
  /** Definiciones de filtros disponibles */
  definitions: FilterDefinition[]
  /** Filtros activos actualmente */
  activeFilters: string[]
  /** Estado de valores de los filtros */
  filterValues: TreeGridFilterState
  /** Callback cuando se activa/desactiva un filtro */
  onToggleFilter: (fieldName: string) => void
  /** Callback cuando cambia el valor de un filtro */
  onFilterChange: (fieldName: string, value: any) => void
  /** Callback para limpiar todos los filtros */
  onClearFilters: () => void
}

export function TreeGridFilters({
  definitions,
  activeFilters,
  filterValues,
  onToggleFilter,
  onFilterChange,
  onClearFilters,
}: TreeGridFiltersProps) {
  const [manageOpen, setManageOpen] = useState(false)

  if (definitions.length === 0) {
    return null
  }

  const activeDefinitions = definitions.filter((d) => activeFilters.includes(d.field))
  const hasActiveFilters = Object.keys(filterValues).length > 0

  return (
    <>
      <div className='border-b bg-muted/30 px-3 py-2 space-y-2'>
        {/* Fila de filtros activos */}
        {activeDefinitions.length > 0 && (
          <div className='flex flex-wrap items-end gap-2'>
            {activeDefinitions.map((def) => (
              <FilterInput
                key={def.field}
                definition={def}
                value={filterValues[def.field]}
                onChange={(value) => onFilterChange(def.field, value)}
                onRemove={() => onToggleFilter(def.field)}
              />
            ))}
            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='sm'
                className='h-9 text-xs'
                onClick={onClearFilters}
              >
                Limpiar
              </Button>
            )}
          </div>
        )}

        {/* Botón para administrar filtros */}
        {definitions.length > 0 && (
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='h-8 text-xs'
              onClick={() => setManageOpen(true)}
            >
              <Settings2 className='size-3.5 me-1' />
              Filtros ({activeFilters.length}/{definitions.length})
            </Button>
          </div>
        )}
      </div>

      {/* Diálogo de administrador de filtros */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Administrar filtros</DialogTitle>
          </DialogHeader>
          <div className='max-h-72 space-y-1 overflow-y-auto'>
            {definitions.map((def) => (
              <label
                key={def.field}
                className='flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted'
              >
                <Checkbox
                  checked={activeFilters.includes(def.field)}
                  onCheckedChange={() => onToggleFilter(def.field)}
                />
                <span className='text-sm'>{def.label || def.field}</span>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Componente individual para renderizar un filtro según su tipo */
interface FilterInputProps {
  definition: FilterDefinition
  value: any
  onChange: (value: any) => void
  onRemove: () => void
}

function FilterInput({ definition, value, onChange, onRemove }: FilterInputProps) {
  const label = definition.label || definition.field

  switch (definition.type) {
    case 'text':
      return (
        <div className='flex items-center gap-1.5'>
          <Input
            placeholder={definition.placeholder || `Filtrar ${label}...`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className='h-8 text-xs'
          />
          <Button
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            onClick={onRemove}
          >
            <X className='size-3.5' />
          </Button>
        </div>
      )

    case 'number':
      return (
        <div className='flex items-center gap-1.5'>
          <Input
            type='number'
            placeholder={definition.placeholder || `${label}...`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className='h-8 w-24 text-xs'
          />
          <Button
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            onClick={onRemove}
          >
            <X className='size-3.5' />
          </Button>
        </div>
      )

    case 'numberRange':
      return (
        <div className='flex items-center gap-1.5'>
          <Input
            type='number'
            placeholder='Min'
            value={value?.min || ''}
            onChange={(e) =>
              onChange({ ...value, min: e.target.value ? Number(e.target.value) : null })
            }
            className='h-8 w-20 text-xs'
          />
          <span className='text-xs text-muted-foreground'>–</span>
          <Input
            type='number'
            placeholder='Max'
            value={value?.max || ''}
            onChange={(e) =>
              onChange({ ...value, max: e.target.value ? Number(e.target.value) : null })
            }
            className='h-8 w-20 text-xs'
          />
          <Button
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            onClick={onRemove}
          >
            <X className='size-3.5' />
          </Button>
        </div>
      )

    case 'dateRange':
      return (
        <div className='flex items-center gap-1.5'>
          <Input
            type='date'
            value={value?.from || ''}
            onChange={(e) =>
              onChange({ ...value, from: e.target.value || null })
            }
            className='h-8 text-xs'
          />
          <span className='text-xs text-muted-foreground'>–</span>
          <Input
            type='date'
            value={value?.to || ''}
            onChange={(e) =>
              onChange({ ...value, to: e.target.value || null })
            }
            className='h-8 text-xs'
          />
          <Button
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            onClick={onRemove}
          >
            <X className='size-3.5' />
          </Button>
        </div>
      )

    case 'select':
      return (
        <div className='flex items-center gap-1.5'>
          <Select value={value || ''} onValueChange={(v) => onChange(v || null)}>
            <SelectTrigger className='h-8 w-40 text-xs'>
              <SelectValue placeholder={definition.placeholder || `Seleccionar ${label}...`} />
            </SelectTrigger>
            <SelectContent>
              {definition.options?.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            onClick={onRemove}
          >
            <X className='size-3.5' />
          </Button>
        </div>
      )

    default:
      return null
  }
}
