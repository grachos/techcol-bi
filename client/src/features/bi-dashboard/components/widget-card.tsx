import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MoreVertical, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { formatCompactNumber, truncateLabel } from '@/lib/format-number'
import { type ActiveFilterValue, type ActiveFilters } from '@/lib/widget-filters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CalendarWidget } from './calendar-widget'
import { ClockWidget } from './clock-widget'
import { ComboWidget } from './combo-widget'
import { DateFilterWidget } from './date-filter-widget'
import { MapWidget } from './map-widget'
import { ProgressWidget } from './progress-widget'
import { SelectFilterWidget } from './select-filter-widget'
import { StatWidget } from './stat-widget'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

const MAX_TABLE_ROWS = 100
const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

function detectKeys(rows: Row[], xKey: string | null, yKey: string | null) {
  if (rows.length === 0) return { x: xKey ?? '', y: yKey ?? '' }
  const columns = Object.keys(rows[0])
  const sample = rows[0]
  const numeric = columns.filter((c) => !isNaN(Number(sample[c])))
  const textual = columns.filter((c) => isNaN(Number(sample[c])))
  return {
    x: xKey || textual[0] || columns[0] || '',
    y: yKey || numeric[0] || '',
  }
}

interface WidgetCardProps {
  widget: Widget
  activeFilters: ActiveFilters
  onFilterChange: (column: string, value: ActiveFilterValue | null) => void
  onEdit: () => void
  onAiEdit?: () => void
  onDelete: () => void
  isEditing: boolean
  isSharedView?: boolean
}

export function WidgetCard({
  widget,
  activeFilters,
  onFilterChange,
  onEdit,
  onAiEdit,
  onDelete,
  isEditing,
  isSharedView = false,
}: WidgetCardProps) {
  const { t } = useTranslation()

  // La tarjeta KPI (stat) va con el fondo de color completo y texto blanco
  const isColoredCard = widget.kind === 'stat' && widget.color !== 'primary'
  const solid = WIDGET_COLOR_CSS[widget.color].solid

  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden gap-0',
        isColoredCard && 'border-transparent text-white'
      )}
      style={isColoredCard ? { background: solid } : undefined}
    >
      <CardHeader className={cn('flex-shrink-0 flex-row items-center justify-between space-y-0 px-2 py-0.5 gap-0.5 min-w-0', isEditing && !isSharedView && 'drag-handle cursor-move')}>
        <CardTitle className='truncate text-xs font-medium leading-none flex-1 min-w-0'>
          {widget.title}
        </CardTitle>
        {isEditing && !isSharedView && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className={cn(
                  'size-5 shrink-0 p-0',
                  isColoredCard && 'text-white hover:bg-white/20 hover:text-white'
                )}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical size={16} />
                <span className='sr-only'>{t('Widget options')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className='size-3.5' /> {t('Edit')}
              </DropdownMenuItem>
              {onAiEdit && (
                <DropdownMenuItem onClick={onAiEdit}>
                  <Sparkles className='size-3.5' /> {t('Edit with AI')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} variant='destructive'>
                <Trash2 className='size-3.5' /> {t('Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className='min-h-0 flex-1 px-2 py-1'>
        {widget.kind === 'chart' && (
          <ChartWidgetBody widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'stat' && (
          <StatWidget
            widget={widget}
            activeFilters={activeFilters}
            onColor={isColoredCard}
          />
        )}
        {widget.kind === 'combo' && (
          <ComboWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'progress' && (
          <ProgressWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'map' && (
          <MapWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'calendar' && (
          <CalendarWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'clock' && <ClockWidget />}
        {widget.kind === 'filter_date' && (
          <DateFilterWidget widget={widget} onChange={onFilterChange} />
        )}
        {widget.kind === 'filter_select' && (
          <SelectFilterWidget widget={widget} onChange={onFilterChange} />
        )}
      </CardContent>
    </Card>
  )
}

function ChartWidgetBody({
  widget,
  activeFilters,
}: {
  widget: Widget
  activeFilters: ActiveFilters
}) {
  const { t } = useTranslation()
  const { rows, filteredRows, error, isLoading, needsDateFilter } =
    useWidgetData(widget, activeFilters)

  const columns = useMemo(
    () => (filteredRows.length > 0 ? Object.keys(filteredRows[0]) : []),
    [filteredRows]
  )
  const { x: xKey, y: yKey } = useMemo(
    () => detectKeys(filteredRows, widget.xKey, widget.yKey),
    [filteredRows, widget.xKey, widget.yKey]
  )
  const chartData = useMemo(
    () =>
      filteredRows.map((r) => ({
        ...r,
        [yKey]: Number(r[yKey]),
      })),
    [filteredRows, yKey]
  )

  if (isLoading) return <WidgetLoading />
  if (needsDateFilter) return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  if (error) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error })} />
  }
  if (rows.length === 0) return <WidgetEmpty text={t('No data yet.')} />
  if (filteredRows.length === 0) {
    return <WidgetEmpty text={t('No rows match the active filters.')} />
  }

  // Widget bajito (h <= 3 filas): sin ejes ni grilla para dejar todo el
  // espacio a la grafica; se recalcula al terminar de redimensionar.
  const compact = widget.layout.h <= 3

  return (
    <ResponsiveContainer width='100%' height='100%'>
      {renderChart(widget.chartType, chartData, xKey, yKey, columns, widget.color, t, compact)}
    </ResponsiveContainer>
  )
}

function renderChart(
  chartType: Widget['chartType'],
  data: Row[],
  xKey: string,
  yKey: string,
  columns: string[],
  color: Widget['color'],
  t: (key: string, opts?: Record<string, unknown>) => string,
  compact = false
) {
  const mainColor = WIDGET_COLOR_CSS[color].solid
  if (chartType === 'table') {
    return (
      <div className='h-full overflow-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, MAX_TABLE_ROWS).map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col}>{String(row[col])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!xKey || !yKey) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No numeric columns to chart')}
      </p>
    )
  }

  const tooltipStyle = {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
  }
  const chartMargin = compact
    ? { top: 4, right: 4, left: 4, bottom: 4 }
    : { top: 6, right: 8, left: -16, bottom: 0 }
  const xAxisProps = {
    dataKey: xKey,
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    tickFormatter: (v: unknown) => truncateLabel(v, 8),
    interval: 'preserveStartEnd' as const,
    minTickGap: 12,
    hide: compact,
  }
  const yAxisProps = {
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    width: 36,
    tickFormatter: (v: number) => formatCompactNumber(v),
    hide: compact,
  }

  if (chartType === 'line') {
    return (
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type='monotone'
          dataKey={yKey}
          stroke={mainColor}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    )
  }

  if (chartType === 'area') {
    return (
      <AreaChart data={data} margin={chartMargin}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type='monotone'
          dataKey={yKey}
          stroke={mainColor}
          fill={mainColor}
          fillOpacity={0.2}
        />
      </AreaChart>
    )
  }

  if (chartType === 'pie') {
    // La torta usa la paleta multicolor, empezando por el color del widget
    const pieColors = [mainColor, ...PIE_COLORS]
    // Con muchas porciones o widget bajito, las etiquetas se solapan
    const showLabels = !compact && data.length <= 6
    return (
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Tooltip contentStyle={tooltipStyle} />
        <Pie
          data={data}
          dataKey={yKey}
          nameKey={xKey}
          outerRadius='75%'
          label={
            showLabels
              ? (entry) => truncateLabel(entry.name, 10)
              : false
          }
          labelLine={showLabels}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={pieColors[i % pieColors.length]} />
          ))}
        </Pie>
      </PieChart>
    )
  }

  return (
    <BarChart data={data} margin={chartMargin}>
      <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} />
      <Bar dataKey={yKey} fill={mainColor} radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}
