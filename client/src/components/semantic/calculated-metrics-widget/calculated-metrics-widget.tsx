import { useState } from 'react'
import { toast } from 'sonner'
import { useSemanticModel } from '@/lib/semantic-layer'
import type { Measure, Row } from '@/lib/semantic-layer'
import { MetricForm } from './metric-form'
import { MetricList } from './metric-list'

export interface CalculatedMetricsWidgetProps {
  /** filas de muestra (del conector activo) usadas para la vista previa en vivo */
  rows: Row[]
  /** dimension usada para agrupar la vista previa; por defecto la primera del modelo */
  previewDimension?: string
}

type EditingState = Measure | 'new' | null

export function CalculatedMetricsWidget({ rows, previewDimension }: CalculatedMetricsWidgetProps) {
  const model = useSemanticModel()
  const [editing, setEditing] = useState<EditingState>(null)

  const calculatedMeasures = model.listMeasures().filter((m) => m.isCalculated)
  const editingMeasure = editing === 'new' ? null : editing
  const fieldCatalog = model
    .getFieldCatalog()
    .filter((entry) => !(editingMeasure && entry.name === editingMeasure.name))

  const handleSave = (measure: Measure) => {
    try {
      model.registerMeasure(measure)
      toast.success(`Métrica "${measure.label}" guardada`)
      setEditing(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = (name: string) => {
    try {
      model.removeMeasure(name)
      toast.success('Métrica eliminada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  if (editing !== null) {
    return (
      <MetricForm
        initial={editingMeasure}
        fieldCatalog={fieldCatalog}
        engine={model.getExpressionEngine()}
        existingNames={model.listMeasures().map((m) => m.name)}
        allMeasures={model.listMeasures()}
        rows={rows}
        previewDimension={previewDimension}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <MetricList
      measures={calculatedMeasures}
      onCreate={() => setEditing('new')}
      onEdit={(measure) => setEditing(measure)}
      onDelete={handleDelete}
    />
  )
}
