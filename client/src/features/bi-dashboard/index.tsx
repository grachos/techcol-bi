import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GridLayout, { type Layout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Grid NO responsivo: siempre 12 columnas. Al cambiar el ancho del contenedor
// (abrir/cerrar sidebar, achicar ventana) las columnas se encogen
// proporcionalmente pero los widgets conservan su posicion y proporcion,
// igual que el dashboard estatico de inicio.
const GridLayoutWithWidth = WidthProvider(GridLayout)
import { toast } from 'sonner'
import { biApi, type Connector } from '@/lib/bi-api'
import {
  dashboardApi,
  type DashboardSummary,
  type Widget,
} from '@/lib/dashboard-api'
import { type WidgetEditSuggestion, type WidgetSuggestion } from '@/lib/ai-api'
import { type ActiveFilterValue, type ActiveFilters } from '@/lib/widget-filters'
import { GRID_COLS, ROW_HEIGHT, stackLayoutForMobile } from '@/lib/grid-layout'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent } from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AiEditWidgetDialog } from './components/ai-edit-widget-dialog'
import { AiWidgetPrompt } from './components/ai-widget-prompt'
import { DashboardToolbar } from './components/dashboard-toolbar'
import { WidgetCard } from './components/widget-card'
import { WidgetDialog } from './components/widget-dialog'


export function BiDashboard() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | undefined>()
  const [aiSuggestion, setAiSuggestion] = useState<WidgetSuggestion | undefined>()
  const [aiEditSuggestion, setAiEditSuggestion] = useState<
    WidgetEditSuggestion | undefined
  >()
  const [aiEditDialogWidget, setAiEditDialogWidget] = useState<
    Widget | undefined
  >()
  const [loading, setLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const [isEditing, setIsEditing] = useState(false)

  const handleFilterChange = (
    column: string,
    value: ActiveFilterValue | null
  ) => {
    setActiveFilters((prev) => {
      if (value === null) {
        const { [column]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [column]: value }
    })
  }

  const loadDashboards = useCallback(
    async (keepSelection = true) => {
      try {
        const list = await dashboardApi.list()
        setDashboards(list)
        if (!keepSelection || (!selectedId && list.length > 0)) {
          setSelectedId(list[0]?.id ?? null)
        } else if (selectedId && !list.some((d) => d.id === selectedId)) {
          setSelectedId(list[0]?.id ?? null)
        }
      } catch (error) {
        toast.error(String(error instanceof Error ? error.message : error))
      }
    },
    [selectedId]
  )

  useEffect(() => {
    loadDashboards(false)
    biApi.list().then(setConnectors).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadWidgets = useCallback(async () => {
    if (!selectedId) {
      setWidgets([])
      return
    }
    setLoading(true)
    try {
      const detail = await dashboardApi.get(selectedId)
      setWidgets(detail.widgets)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    setActiveFilters({})
    loadWidgets()
  }, [loadWidgets])

  const handleLayoutChange = (layout: Layout[]) => {
    // En movil el layout es la pila derivada de 1 columna: nunca persistirla
    if (!selectedId || widgets.length === 0 || !isEditing || isMobile) return
    const changed = layout.some((l) => {
      const w = widgets.find((wi) => String(wi.id) === l.i)
      return (
        w &&
        (w.layout.x !== l.x ||
          w.layout.y !== l.y ||
          w.layout.w !== l.w ||
          w.layout.h !== l.h)
      )
    })
    if (!changed) return

    setWidgets((prev) =>
      prev.map((w) => {
        const l = layout.find((li) => li.i === String(w.id))
        return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w
      })
    )
    dashboardApi
      .updateLayout(
        selectedId,
        layout.map((l) => ({
          id: Number(l.i),
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
        }))
      )
      .catch((error) =>
        toast.error(String(error instanceof Error ? error.message : error))
      )
  }

  const handleDeleteWidget = async (widget: Widget) => {
    if (!selectedId) return
    if (!window.confirm(t('Delete widget "{{title}}"?', { title: widget.title })))
      return
    try {
      await dashboardApi.removeWidget(selectedId, widget.id)
      toast.success(t('Widget deleted'))
      loadWidgets()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  const desktopLayout: Layout[] = widgets.map((w) => ({
    i: String(w.id),
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: 1,
    minH: 3,
  }))
  const layout = isMobile ? stackLayoutForMobile(desktopLayout) : desktopLayout
  const gridCols = isMobile ? 1 : GRID_COLS

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            {t('BI Dashboard')}
          </h2>
          <p className='text-muted-foreground'>
            {t('Build your own dashboard: add widgets from your connectors.')}
          </p>
        </div>

        <DashboardToolbar
          dashboards={dashboards}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChanged={() => loadDashboards(true)}
          onAddWidget={() => {
            setEditingWidget(undefined)
            setAiSuggestion(undefined)
            setAiEditSuggestion(undefined)
            setDialogOpen(true)
          }}
          isEditing={isEditing}
          onToggleEditing={setIsEditing}
        />

        {connectors.length > 0 && selectedId && (
          <AiWidgetPrompt
            onSuggestion={(suggestion) => {
              setEditingWidget(undefined)
              setAiSuggestion(suggestion)
              setAiEditSuggestion(undefined)
              setDialogOpen(true)
            }}
          />
        )}

        {connectors.length === 0 && (
          <Card>
            <CardContent className='text-muted-foreground py-10 text-center text-sm'>
              {t('No connectors configured. Go to')}{' '}
              <a href='/connectors' className='underline'>
                {t('Connectors')}
              </a>{' '}
              {t('and create the first one.')}
            </CardContent>
          </Card>
        )}

        {connectors.length > 0 && !loading && widgets.length === 0 && (
          <Card>
            <CardContent className='text-muted-foreground py-10 text-center text-sm'>
              {t('This dashboard has no widgets yet. Click "Add widget" to create the first one.')}
            </CardContent>
          </Card>
        )}

        {widgets.length > 0 && (
          <GridLayoutWithWidth
            className='layout'
            layout={layout}
            cols={gridCols}
            rowHeight={ROW_HEIGHT}
            isDraggable={isEditing && !isMobile}
            isResizable={isEditing && !isMobile}
            draggableHandle={isEditing && !isMobile ? '.drag-handle' : undefined}
            onLayoutChange={handleLayoutChange}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            compactType='vertical'
            preventCollision={false}
          >
            {widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetCard
                  widget={widget}
                  activeFilters={activeFilters}
                  onFilterChange={handleFilterChange}
                  onEdit={() => {
                    setEditingWidget(widget)
                    setAiSuggestion(undefined)
                    setAiEditSuggestion(undefined)
                    setDialogOpen(true)
                  }}
                  onAiEdit={() => setAiEditDialogWidget(widget)}
                  onDelete={() => handleDeleteWidget(widget)}
                  isEditing={isEditing}
                />
              </div>
            ))}
          </GridLayoutWithWidth>
        )}
      </Main>

      {selectedId && (
        <WidgetDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          dashboardId={selectedId}
          connectors={connectors}
          widget={editingWidget}
          aiSuggestion={aiSuggestion}
          aiEditSuggestion={aiEditSuggestion}
          onSaved={loadWidgets}
        />
      )}

      {selectedId && aiEditDialogWidget && (
        <AiEditWidgetDialog
          open={!!aiEditDialogWidget}
          onOpenChange={(open) => {
            if (!open) setAiEditDialogWidget(undefined)
          }}
          dashboardId={selectedId}
          widget={aiEditDialogWidget}
          onSuggestion={(suggestion) => {
            setEditingWidget(aiEditDialogWidget)
            setAiSuggestion(undefined)
            setAiEditSuggestion(suggestion)
            setAiEditDialogWidget(undefined)
            setDialogOpen(true)
          }}
        />
      )}
    </>
  )
}
