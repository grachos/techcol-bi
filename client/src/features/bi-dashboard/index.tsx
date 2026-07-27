import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearch } from '@tanstack/react-router'
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
import {
  type ActiveFilterValue,
  type ActiveFilters,
  filtersToParams,
} from '@/lib/widget-filters'
import { GRID_COLS, ROW_HEIGHT, stackLayoutForMobile } from '@/lib/grid-layout'
import { getConnectorSemanticModel } from '@/lib/semantic-layer'
import { useIsMobile } from '@/hooks/use-mobile'
import { useConnectorData } from '@/hooks/use-connector-data'
import { useDashboardPersistence } from '@/hooks/use-dashboard-persistence'
import { Card, CardContent } from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { WidgetErrorBoundary } from '@/components/widget-error-boundary'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AiEditWidgetDialog } from './components/ai-edit-widget-dialog'
import { AiWidgetPrompt } from './components/ai-widget-prompt'
import { DashboardMetricsSheet } from './components/dashboard-metrics-sheet'
import { DashboardToolbar } from './components/dashboard-toolbar'
import { WidgetCard } from './components/widget-card'
import { WidgetDialog } from './components/widget-dialog'


export function BiDashboard() {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const search = useSearch({ from: '/_authenticated/bi/' })
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
  const [metricsOpen, setMetricsOpen] = useState(false)

  // Widget de referencia para el panel de Metricas: el primer widget con
  // conector propio en el dashboard actual (prioriza tree_grid, ya que sus
  // columnas de valor son las que consumen medidas del modelo semantico).
  const metricsWidget =
    widgets.find((w) => w.kind === 'tree_grid' && w.connectorId != null) ??
    widgets.find((w) => w.connectorId != null)
  const metricsParams = useMemo(
    () =>
      metricsWidget?.connectorType === 'rest_api' ? filtersToParams(activeFilters) : {},
    [metricsWidget, activeFilters]
  )
  // Solo se piden las filas con el panel ABIERTO. Este es el unico consumidor
  // de filas crudas que queda en el dashboard, y traerlas siempre significaba
  // bajar el dataset entero del primer conector en cada carga -- para un panel
  // que la mayoria de las veces no se abre. Al abrirlo, el sheet ya muestra su
  // propio estado de carga con `metricsLoading`.
  const { rows: metricsRows, isLoading: metricsLoading } = useConnectorData(
    metricsWidget?.connectorId,
    metricsParams,
    undefined,
    metricsOpen
  )
  // Inferir el modelo recorre las columnas de la muestra; sin useMemo se
  // rehacia en cada render del dashboard (incluido cada tecla del editor).
  const metricsConnectorId = metricsWidget?.connectorId ?? null
  const metricsModel = useMemo(
    () =>
      metricsConnectorId
        ? getConnectorSemanticModel(metricsConnectorId, metricsRows)
        : null,
    [metricsConnectorId, metricsRows]
  )
  const metricsConnectorName =
    connectors.find((c) => c.id === metricsWidget?.connectorId)?.name ?? null

  // Identidad estable (solo usa el setter funcional): si cambiara en cada
  // render anularia el memo() de WidgetCard, que es justo lo que evita
  // repintar todos los Recharts al abrir un dialogo o entrar en modo edicion.
  const handleFilterChange = useCallback(
    (column: string, value: ActiveFilterValue | null) => {
      setActiveFilters((prev) => {
        if (value !== null) return { ...prev, [column]: value }
        // Devolver `prev` tal cual cuando la columna ya no estaba evita una
        // identidad nueva de activeFilters -- que seria una ronda de refetch
        // en todos los widgets para terminar con los mismos filtros.
        if (!(column in prev)) return prev
        const rest: ActiveFilters = {}
        for (const key of Object.keys(prev)) {
          if (key !== column) rest[key] = prev[key]
        }
        return rest
      })
    },
    []
  )

  // Persistir el estado actual
  useDashboardPersistence(selectedId, activeFilters)

  const loadDashboards = useCallback(
    async (keepSelection = true) => {
      try {
        const list = await dashboardApi.list()
        setDashboards(list)

        // Prioriza: dashboardId de URL > selectedId actual > primer dashboard
        const urlDashboardId = search?.dashboardId
        const targetId = urlDashboardId
          ? urlDashboardId
          : !keepSelection
            ? list[0]?.id ?? null
            : (selectedId ?? list[0]?.id) ?? null

        setSelectedId(targetId)
      } catch (error) {
        toast.error(String(error instanceof Error ? error.message : error))
      }
    },
    [selectedId, search]
  )

  useEffect(() => {
    loadDashboards(false)
    biApi.list().then(setConnectors).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadWidgets = useCallback(async () => {
    if (!selectedId) {
      setWidgets([])
      setActiveFilters({})
      return
    }
    setLoading(true)
    try {
      const detail = await dashboardApi.get(selectedId)
      setWidgets(detail.widgets)
      // Restaura la ultima consulta (filtros) guardada en el servidor para
      // este dashboard, en vez de arrancar siempre en blanco.
      setActiveFilters(detail.lastFilters ?? {})
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
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
    // i18n.t y no la `t` del render: este callback queda capturado dentro del
    // memo() de WidgetCard, asi que la `t` de su render podria ser de un idioma
    // ya cambiado. i18n.t siempre resuelve con el idioma actual.
    if (
      !window.confirm(
        i18n.t('Delete widget "{{title}}"?', { title: widget.title })
      )
    )
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
    minH: 2,
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
          onOpenMetrics={() => setMetricsOpen(true)}
          metricsAvailable={!!metricsWidget}
        />

        {isEditing && connectors.length > 0 && selectedId && (
          <AiWidgetPrompt
            connectors={connectors}
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
                <WidgetErrorBoundary>
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
                    onDelete={() => handleDeleteWidget(widget)}
                    isEditing={isEditing}
                  />
                </WidgetErrorBoundary>
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

      <DashboardMetricsSheet
        open={metricsOpen}
        onOpenChange={setMetricsOpen}
        connectorName={metricsConnectorName}
        model={metricsModel}
        rows={metricsRows}
        loading={metricsLoading}
      />
    </>
  )
}
