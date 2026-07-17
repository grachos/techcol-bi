import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Estados de interfaz compartidos por los widgets con datos. Se distingue
 * "cargando" de "sin datos": antes ambos casos mostraban "No data yet.", que
 * hacia parecer vacia una consulta que todavia estaba resolviendo.
 *
 * `onColor` = el widget va sobre un fondo de color solido (tarjeta KPI), donde
 * los tonos muted/destructive no contrastan.
 */

interface StateProps {
  onColor?: boolean
}

export function WidgetLoading({ onColor }: StateProps) {
  return (
    <div className='flex h-full items-center justify-center'>
      <Loader2
        className={cn(
          'size-4 animate-spin',
          onColor ? 'text-white/70' : 'text-muted-foreground'
        )}
      />
      <span className='sr-only'>Cargando…</span>
    </div>
  )
}

export function WidgetError({ error, onColor }: StateProps & { error: string }) {
  return (
    <p className={cn('text-xs', onColor ? 'text-white/90' : 'text-destructive')}>
      {error}
    </p>
  )
}

export function WidgetEmpty({ text, onColor }: StateProps & { text: string }) {
  return (
    <p className={cn('text-xs', onColor ? 'text-white/80' : 'text-muted-foreground')}>
      {text}
    </p>
  )
}
