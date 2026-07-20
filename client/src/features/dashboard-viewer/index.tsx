import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from '@tanstack/react-router'
import GridLayout, { type Layout, WidthProvider } from 'react-grid-layout'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { toast } from 'sonner'
import { biApi, type Connector } from '@/lib/bi-api'
import {
  dashboardApi,
  type Widget,
} from '@/lib/dashboard-api'
import { type ActiveFilterValue, type ActiveFilters, filtersToParams } from '@/lib/widget-filters'
import { GRID_COLS, ROW_HEIGHT, stackLayoutForMobile } from '@/lib/grid-layout'
import { useIsMobile } from '@/hooks/use-mobile'
import { useDashboardPersistence } from '@/hooks/use-dashboard-persistence'
import { Card, CardContent } from '@/components/ui/card'
import { WidgetErrorBoundary } from '@/components/widget-error-boundary'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { WidgetCard } from '@/features/bi-dashboard/components/widget-card'

const GridLayoutWithWidth = WidthProvider(GridLayout)

export function DashboardViewer() {
  const { t } = useTranslation()
  const { dashboardId } = useParams({ strict: false })
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [dashboard, setDashboard] = useState<{ name: string; widgets: Widget[] } | null>(null)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})

  // Persistir cambios de filtro en el servidor (aplica a cualquier punto de entrada)
  useDashboardPersistence(dashboardId ? Number(dashboardId) : null, activeFilters)

  useEffect(() => {
    loadDashboard()
    loadConnectors()
  }, [dashboardId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const detail = await dashboardApi.get(Number(dashboardId))
      setDashboard(detail)
      // Restaura la ultima consulta (filtros) guardada en el servidor
      setActiveFilters(detail.lastFilters ?? {})
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setLoading(false)
    }
  }

  const loadConnectors = async () => {
    try {
      const list = await biApi.list()
      setConnectors(list)
    } catch {
      // Silent fail
    }
  }

  const handleFilterChange = (column: string, value: ActiveFilterValue | null) => {
    setActiveFilters((prev) => {
      if (value === null) {
        const { [column]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [column]: value }
    })
  }

  const desktopLayout: Layout[] = (dashboard?.widgets ?? []).map((w) => ({
    i: String(w.id),
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: 1,
    minH: 2,
    static: true, // No dragging/resizing in read-only mode
  }))
  const layout = isMobile ? stackLayoutForMobile(desktopLayout) : desktopLayout
  const gridCols = isMobile ? 1 : GRID_COLS

  if (loading) {
    return (
      <>
        <Header fixed>
          <Search className='me-auto' />
          <LanguageSwitch />
          <ThemeSwitch />
          <ProfileDropdown />
        </Header>
        <Main className='flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
            <p className='text-muted-foreground'>{t('Loading dashboard...')}</p>
          </div>
        </Main>
      </>
    )
  }

  if (!dashboard) {
    return (
      <>
        <Header fixed>
          <Search className='me-auto' />
          <LanguageSwitch />
          <ThemeSwitch />
          <ProfileDropdown />
        </Header>
        <Main className='flex items-center justify-center'>
          <div className='text-center'>
            <h2 className='text-xl font-semibold mb-2'>{t('Dashboard not found')}</h2>
            <Button onClick={() => navigate({ to: '/dashboard' })}>
              {t('Back to Dashboards')}
            </Button>
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon' onClick={() => navigate({ to: '/' })}>
              <ArrowLeft className='size-5' />
            </Button>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>{dashboard.name}</h2>
              <p className='text-muted-foreground text-sm'>
                {t('View Only Mode • Changes are not saved')}
              </p>
            </div>
          </div>
          <Button onClick={loadDashboard} variant='outline'>
            <RotateCcw className='size-4 me-2' />
            {t('Refresh data')}
          </Button>
        </div>

        {dashboard.widgets.length === 0 ? (
          <Card>
            <CardContent className='text-muted-foreground py-10 text-center text-sm'>
              {t('This dashboard has no widgets yet.')}
            </CardContent>
          </Card>
        ) : (
          <GridLayoutWithWidth
            className='layout'
            layout={layout}
            cols={gridCols}
            rowHeight={ROW_HEIGHT}
            isDraggable={false}
            isResizable={false}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            compactType='vertical'
            preventCollision={false}
          >
            {dashboard.widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetErrorBoundary>
                  <WidgetCard
                    widget={widget}
                    activeFilters={activeFilters}
                    onFilterChange={handleFilterChange}
                    onEdit={() => {}} // No-op in read-only mode
                    onAiEdit={() => {}} // No-op in read-only mode
                    onDelete={() => {}} // No-op in read-only mode
                    isEditing={false}
                    isSharedView={true} // Disable edit actions
                  />
                </WidgetErrorBoundary>
              </div>
            ))}
          </GridLayoutWithWidth>
        )}
      </Main>
    </>
  )
}
