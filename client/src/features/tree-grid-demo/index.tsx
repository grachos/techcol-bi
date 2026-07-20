import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { LanguageSwitch } from '@/components/language-switch'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  generateMockSalesData,
  TreeGrid,
  type SalesRecord,
  type TreeGridColumn,
  type TreeGridGroupLevel,
  type TreeGridState,
} from '@/components/tree-grid'

const columns: TreeGridColumn<SalesRecord>[] = [
  {
    id: 'product',
    header: 'Producto / Grupo',
    accessor: (r) => r.product,
    type: 'text',
    width: 260,
    minWidth: 180,
    pinned: 'left',
  },
  {
    id: 'region',
    header: 'Región',
    accessor: (r) => r.region,
    type: 'text',
    width: 140,
  },
  {
    id: 'date',
    header: 'Fecha',
    accessor: (r) => r.date,
    type: 'date',
    width: 120,
  },
  {
    id: 'units',
    header: 'Unidades',
    accessor: (r) => r.units,
    type: 'number',
    align: 'right',
    width: 100,
    aggregate: (rows) => rows.reduce((sum, r) => sum + r.units, 0),
  },
  {
    id: 'revenue',
    header: 'Ingresos',
    accessor: (r) => r.revenue,
    type: 'currency',
    align: 'right',
    width: 130,
    aggregate: (rows) => rows.reduce((sum, r) => sum + r.revenue, 0),
  },
  {
    id: 'cost',
    header: 'Costo',
    accessor: (r) => r.cost,
    type: 'currency',
    align: 'right',
    width: 130,
    aggregate: (rows) => rows.reduce((sum, r) => sum + r.cost, 0),
  },
  {
    id: 'margin',
    header: 'Margen',
    accessor: (r) => r.margin,
    type: 'percent',
    align: 'right',
    width: 110,
    aggregate: (rows) => {
      const revenue = rows.reduce((sum, r) => sum + r.revenue, 0)
      const cost = rows.reduce((sum, r) => sum + r.cost, 0)
      return revenue === 0 ? 0 : (revenue - cost) / revenue
    },
    rules: [
      {
        when: (value, row) => Number(value) < row.marginTarget,
        className: 'text-red-600 dark:text-red-400 font-semibold',
      },
      {
        when: (value, row) => Number(value) >= row.marginTarget,
        className: 'text-emerald-600 dark:text-emerald-400 font-semibold',
      },
    ],
  },
  {
    id: 'marginTarget',
    header: 'Meta de margen',
    accessor: (r) => r.marginTarget,
    type: 'percent',
    align: 'right',
    width: 120,
    visible: false,
  },
]

const groupBy: TreeGridGroupLevel<SalesRecord>[] = [
  { id: 'region', label: 'Región', accessor: (r) => r.region },
  { id: 'category', label: 'Categoría', accessor: (r) => r.category },
]

export function TreeGridDemo() {
  const { t } = useTranslation()
  const data = useMemo(() => generateMockSalesData(2000), [])
  const [state, setState] = useState<TreeGridState>('idle')

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>{t('Analytic TreeGrid')}</h2>
            <p className='text-muted-foreground'>
              {t('Enterprise widget with hierarchical grouping, virtualization and conditional formatting.')}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={() => setState('idle')}>
              {t('Normal')}
            </Button>
            <Button variant='outline' size='sm' onClick={() => setState('loading')}>
              {t('Loading')}
            </Button>
            <Button variant='outline' size='sm' onClick={() => setState('error')}>
              {t('Error')}
            </Button>
          </div>
        </div>

        <TreeGrid
          title={t('Sales by region and category')}
          columns={columns}
          data={data}
          groupBy={groupBy}
          state={state}
          height={600}
          defaultExpandedDepth={1}
        />
      </Main>
    </>
  )
}
