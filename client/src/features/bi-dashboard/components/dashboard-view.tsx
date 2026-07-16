import { useState } from 'react'
import GridLayout, { type Layout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Grid NO responsivo: 12 columnas fijas que se encogen proporcionalmente
// con el ancho disponible, conservando siempre la disposicion original.
const GridLayoutWithWidth = WidthProvider(GridLayout)
import { type ActiveFilterValue, type ActiveFilters } from '@/lib/widget-filters'
import { Card, CardContent } from '@/components/ui/card'
import { WidgetCard } from './widget-card'

const GRID_COLS = 12
const ROW_HEIGHT = 40

interface DashboardViewProps {
  dashboard: any
}

export function DashboardView({ dashboard }: DashboardViewProps) {
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})

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

  const widgets = dashboard?.widgets || []

  const layout: Layout[] = widgets.map((w: any) => ({
    i: String(w.id),
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: 1,
    minH: 3,
  }))

  if (!widgets.length) {
    return (
      <Card className='m-4'>
        <CardContent className='text-muted-foreground py-10 text-center text-sm'>
          Este dashboard no tiene widgets
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='p-4'>
      {widgets.length > 0 && (
        <GridLayoutWithWidth
          className='layout'
          layout={layout}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          isDraggable={false}
          isResizable={false}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          compactType='vertical'
          preventCollision={false}
        >
          {widgets.map((widget: any) => (
            <div key={widget.id}>
              <WidgetCard
                widget={widget}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onEdit={() => {}}
                onDelete={() => {}}
                isEditing={false}
                isSharedView={true}
              />
            </div>
          ))}
        </GridLayoutWithWidth>
      )}
    </div>
  )
}
