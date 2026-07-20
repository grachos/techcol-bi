import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { LanguageSwitch } from '@/components/language-switch'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  SemanticLayerProvider,
  useSemanticQuery,
  useSemanticModel,
} from '@/lib/semantic-layer'
import { createDemoSemanticModel, getDemoRows } from '@/lib/semantic-layer/demo-model'
import type { Row } from '@/lib/semantic-layer'
import { CalculatedMetricsWidget } from '@/components/semantic/calculated-metrics-widget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function SemanticLayerDemo() {
  const { t } = useTranslation()
  const model = useMemo(() => createDemoSemanticModel(), [])
  const rows = useMemo(() => getDemoRows(), [])

  return (
    <SemanticLayerProvider model={model}>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>{t('Semantic Layer')}</h2>
          <p className='text-muted-foreground'>
            {t('Centralized semantic layer with Expression Engine. Widgets consume metrics defined here; none calculate data on their own.')}
          </p>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('Calculated Metrics Widget')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CalculatedMetricsWidget rows={rows} previewDimension='region' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('Metric consumption by region')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsByDimension rows={rows} />
            </CardContent>
          </Card>
        </div>
      </Main>
    </SemanticLayerProvider>
  )
}

/**
 * Widget de demostracion que consume la Semantic Layer via useSemanticQuery:
 * pide todas las medidas registradas agrupadas por region, sin calcular nada
 * por si mismo. Muestra que cualquier medida (base o recien creada en el
 * editor) queda disponible automaticamente para el resto de widgets.
 */
function MetricsByDimension({ rows }: { rows: Row[] }) {
  const model = useSemanticModel()
  const [dimension] = useState('region')

  const measures = model.listMeasures()
  const metricNames = measures.map((m) => m.name)

  const result = useSemanticQuery(rows, {
    metrics: metricNames,
    dimensions: [dimension],
  })

  const dimensionLabel = model.getDimension(dimension)?.label ?? dimension

  return (
    <div className='max-h-[520px] overflow-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='sticky top-0 bg-background'>{dimensionLabel}</TableHead>
            {measures.map((measure) => (
              <TableHead key={measure.name} className='sticky top-0 bg-background text-end'>
                {measure.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className='font-medium'>
                {String(row.dimensionValues[dimension] ?? '—')}
              </TableCell>
              {measures.map((measure) => (
                <TableCell key={measure.name} className='text-end tabular-nums'>
                  {row.formatted[measure.name]}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className='font-semibold'>
            <TableCell>Total</TableCell>
            {measures.map((measure) => (
              <TableCell key={measure.name} className='text-end tabular-nums'>
                {result.totals.formatted[measure.name]}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
