import { useTranslation } from 'react-i18next'
import { CalculatedMetricsWidget } from '@/components/semantic/calculated-metrics-widget'
import {
  SemanticLayerProvider,
  type Row,
  type SemanticModel,
} from '@/lib/semantic-layer'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface DashboardMetricsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorName: string | null
  model: SemanticModel | null
  rows: Row[]
  loading: boolean
}

/**
 * Panel de metricas calculadas para el dashboard real: crea formulas (ej.
 * "rentabilidad") sobre los datos en vivo del conector activo. Cualquier
 * metrica guardada aqui queda disponible de inmediato para las columnas de
 * valor de la Tabla dinamica (tree_grid) que apunten al mismo conector, sin
 * recargar la pagina -- es el mismo modelo semantico, compartido.
 */
export function DashboardMetricsSheet({
  open,
  onOpenChange,
  connectorName,
  model,
  rows,
  loading,
}: DashboardMetricsSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full gap-0 overflow-y-auto sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{t('Calculated metrics')}</SheetTitle>
          <SheetDescription>
            {connectorName
              ? t('Metrics defined here are computed from live "{{name}}" data and become available to this dashboard\'s tree table widgets right away.', { name: connectorName })
              : t('Add a widget with a connector first to define metrics for it.')}
          </SheetDescription>
        </SheetHeader>
        <div className='px-4 pb-6'>
          {loading && (
            <p className='text-muted-foreground text-sm'>{t('Loading connector data…')}</p>
          )}
          {!loading && model && (
            <SemanticLayerProvider model={model}>
              <CalculatedMetricsWidget rows={rows} previewDimension={model.listDimensions()[0]?.name} />
            </SemanticLayerProvider>
          )}
          {!loading && !model && connectorName && (
            <p className='text-muted-foreground text-sm'>
              {t('No data available yet from this connector.')}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
