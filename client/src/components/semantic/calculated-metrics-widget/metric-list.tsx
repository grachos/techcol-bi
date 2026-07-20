import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Sigma, Trash2 } from 'lucide-react'
import type { Measure } from '@/lib/semantic-layer'
import { Button } from '@/components/ui/button'

interface MetricListProps {
  measures: Measure[]
  onCreate: () => void
  onEdit: (measure: Measure) => void
  onDelete: (name: string) => void
}

export function MetricList({ measures, onCreate, onEdit, onDelete }: MetricListProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium'>{t('Métricas calculadas')}</p>
        <Button size='sm' onClick={onCreate}>
          <Plus className='size-4' />
          {t('Nueva métrica')}
        </Button>
      </div>

      {measures.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No calculated metrics yet. Create the first one with "New metric".')}
        </p>
      ) : (
        <ul className='divide-y rounded-md border'>
          {measures.map((measure) => (
            <li key={measure.name} className='flex items-center justify-between gap-2 px-3 py-2'>
              <div className='min-w-0'>
                <div className='flex items-center gap-1.5'>
                  <Sigma className='size-3.5 shrink-0 text-muted-foreground' />
                  <span className='truncate text-sm font-medium'>{measure.label}</span>
                  <span className='text-muted-foreground shrink-0 text-xs'>({measure.name})</span>
                </div>
                <p className='text-muted-foreground truncate font-mono text-xs'>
                  {measure.expression}
                </p>
              </div>
              <div className='flex shrink-0 gap-1'>
                <Button variant='ghost' size='icon' className='size-7' onClick={() => onEdit(measure)}>
                  <Pencil className='size-3.5' />
                  <span className='sr-only'>Editar</span>
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-destructive hover:text-destructive size-7'
                  onClick={() => onDelete(measure.name)}
                >
                  <Trash2 className='size-3.5' />
                  <span className='sr-only'>Eliminar</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
