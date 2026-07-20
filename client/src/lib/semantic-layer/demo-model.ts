import { generateMockSalesData } from '@/components/tree-grid/mock-data'
import { LocalStorageMetricsRepository } from './repository'
import { SemanticModel } from './semantic-model'
import type { Measure, Row } from './types'

const DEMO_STORAGE_KEY = 'semantic-layer-demo-metrics'

/** Registra una medida calculada de ejemplo solo si no existe ya (para no pisar ediciones guardadas por el usuario). */
function seed(model: SemanticModel, measure: Measure) {
  if (model.getMeasure(measure.name)) return
  model.registerMeasure(measure)
}

export function createDemoSemanticModel(): SemanticModel {
  const model = new SemanticModel({
    repository: new LocalStorageMetricsRepository(DEMO_STORAGE_KEY),
  })

  model.registerDimension({ name: 'region', label: 'Región', field: 'region' })
  model.registerDimension({ name: 'category', label: 'Categoría', field: 'category' })
  model.registerDimension({ name: 'product', label: 'Producto', field: 'product' })

  model.registerMeasure({
    name: 'revenue',
    label: 'Ingresos',
    expression: 'SUM(revenue)',
    format: { type: 'currency', decimals: 0 },
  })
  model.registerMeasure({
    name: 'cost',
    label: 'Costo',
    expression: 'SUM(cost)',
    format: { type: 'currency', decimals: 0 },
  })
  model.registerMeasure({
    name: 'units',
    label: 'Unidades',
    expression: 'SUM(units)',
    format: { type: 'number', decimals: 0 },
  })
  model.registerMeasure({
    name: 'orders',
    label: 'Registros',
    expression: 'COUNT()',
    format: { type: 'number', decimals: 0 },
  })
  model.registerMeasure({
    name: 'meta_margen',
    label: 'Meta de margen',
    expression: 'AVG(marginTarget)',
    format: { type: 'percent', decimals: 1 },
  })

  seed(model, {
    name: 'utilidad',
    label: 'Utilidad',
    expression: 'revenue - cost',
    format: { type: 'currency', decimals: 0 },
    isCalculated: true,
    description: 'Ingresos menos costo',
  })
  seed(model, {
    name: 'margen',
    label: 'Margen',
    expression: 'IF(revenue == 0, 0, (revenue - cost) / revenue)',
    format: { type: 'percent', decimals: 1 },
    isCalculated: true,
    description: 'Utilidad sobre ingresos',
  })
  seed(model, {
    name: 'rentabilidad',
    label: 'Rentabilidad',
    expression: 'IF(cost == 0, 0, utilidad / cost)',
    format: { type: 'percent', decimals: 1 },
    isCalculated: true,
    description: 'Utilidad sobre costo (ROI)',
  })
  seed(model, {
    name: 'costo_promedio',
    label: 'Costo Promedio',
    expression: 'IF(units == 0, 0, cost / units)',
    format: { type: 'currency', decimals: 2 },
    isCalculated: true,
    description: 'Costo total entre unidades',
  })
  seed(model, {
    name: 'cumplimiento',
    label: 'Cumplimiento',
    expression: 'IF(meta_margen == 0, 0, margen / meta_margen)',
    format: { type: 'percent', decimals: 0 },
    isCalculated: true,
    description: 'Margen real sobre la meta de margen',
  })

  model.registerKpi({
    name: 'kpi_margen',
    label: 'Margen',
    metric: 'margen',
    targetMetric: 'meta_margen',
    format: { type: 'percent', decimals: 1 },
    goodDirection: 'up',
  })

  return model
}

export function getDemoRows(): Row[] {
  return generateMockSalesData(2000) as unknown as Row[]
}
