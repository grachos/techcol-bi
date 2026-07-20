import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface WidgetErrorBoundaryProps {
  children: ReactNode
}

interface WidgetErrorBoundaryState {
  error: Error | null
}

/**
 * Aisla el crash de un widget individual (ej. quedo con una columna que ya
 * no existe tras borrar una metrica) para que no tumbe toda la pagina del
 * dashboard con la pantalla de error generica.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Error al renderizar widget:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className='flex h-full flex-col items-center justify-center gap-1 p-2 text-center'>
          <AlertTriangle className='size-4 text-destructive' />
          <p className='text-destructive text-xs'>Error al mostrar este widget</p>
          <p className='text-muted-foreground text-xs'>{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
