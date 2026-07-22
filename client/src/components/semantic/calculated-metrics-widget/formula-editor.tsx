import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { FieldCatalogEntry } from '@/lib/semantic-layer'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

interface FormulaEditorProps {
  value: string
  onChange: (value: string) => void
  fieldCatalog: FieldCatalogEntry[]
  error: string | null
}

export function FormulaEditor({ value, onChange, fieldCatalog, error }: FormulaEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertReference = (name: string) => {
    const el = textareaRef.current
    if (!el) {
      onChange(value + name)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + name + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + name.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className='space-y-2'>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='(revenue - cost) / revenue'
        rows={3}
        className={cn('font-mono text-sm', error && 'border-destructive')}
      />
      {error && <p className='text-destructive text-xs'>{error}</p>}
      {fieldCatalog.length > 0 && (
        <div className='space-y-1.5 pt-1'>
          <div className='flex items-center justify-between text-[11px] text-muted-foreground font-medium'>
            <span>Campos y métricas disponibles (haz clic para insertar):</span>
            <span className='flex gap-3 text-[10px]'>
              <span className='text-slate-600 dark:text-slate-400'># Dimensión</span>
              <span className='text-blue-600 dark:text-blue-400'>ƒ Base</span>
              <span className='text-purple-600 dark:text-purple-400 font-medium'>∑ Calculada</span>
            </span>
          </div>
          <div className='flex flex-wrap gap-1 max-h-44 overflow-y-auto p-1.5 rounded-md border bg-muted/20'>
            {fieldCatalog.map((entry) => {
              const isCalc = entry.kind === 'measure' && entry.isCalculated
              const isBaseMeasure = entry.kind === 'measure' && !entry.isCalculated

              let badgeStyle = 'bg-slate-500/10 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-500/20'
              let prefix = '#'

              if (isCalc) {
                badgeStyle = 'bg-purple-500/15 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 hover:bg-purple-500/25 font-medium'
                prefix = '∑'
              } else if (isBaseMeasure) {
                badgeStyle = 'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-500/20'
                prefix = 'ƒ'
              }

              return (
                <Badge
                  key={entry.name}
                  variant='outline'
                  className={cn('cursor-pointer text-xs font-normal transition-colors', badgeStyle)}
                  onClick={() => insertReference(entry.name)}
                  title={`${entry.description ? `${entry.description} - ` : ''}Nombre técnico: ${entry.name}`}
                >
                  <span className='me-1 font-semibold opacity-80'>{prefix}</span>
                  {entry.label}
                </Badge>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
