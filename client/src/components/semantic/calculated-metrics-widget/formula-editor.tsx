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
        <div className='flex flex-wrap gap-1'>
          {fieldCatalog.map((entry) => (
            <Badge
              key={entry.name}
              variant='outline'
              className='cursor-pointer font-normal hover:bg-accent'
              onClick={() => insertReference(entry.name)}
              title={entry.description}
            >
              {entry.kind === 'measure' ? 'ƒ' : '#'} {entry.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
