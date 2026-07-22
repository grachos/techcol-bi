import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { useStatAggregation } from '@/hooks/use-stat-aggregation'
import { getWidgetColorCss, isLightColor, type Widget } from '@/lib/dashboard-api'
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
import { TreeGridWidget } from './tree-grid-widget'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

const MAX_TABLE_ROWS = 100
// Recharts pinta un nodo SVG por punto (una <rect>/<circle> por barra,
// punto de linea o porcion de torta): miles de puntos crudos son ilegibles
// visualmente ademas de lentos de pintar/repintar. Si la fuente no viene ya
// agrupada (ej. "chart" sobre filas crudas en vez de una metrica agregada),
// se recorta a las primeras MAX_CHART_POINTS y se avisa en vez de graficar
// todo el dataset.
const MAX_CHART_POINTS = 500
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

  // La tarjeta KPI (stat) va con el fondo de color completo
  const isColoredCard = widget.kind === 'stat' && widget.color !== 'primary'
  const solid = getWidgetColorCss(widget.color).solid
  const isLight = isColoredCard && isLightColor(widget.color)

  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden gap-0',
        isColoredCard && (isLight ? 'border-transparent text-slate-900 font-medium' : 'border-transparent text-white')
      )}
      style={isColoredCard ? { background: solid } : undefined}
    >
      <CardHeader className={cn('flex-shrink-0 flex-row items-center justify-between space-y-0 px-2 py-0.5 gap-0.5 min-w-0', isEditing && !isSharedView && 'drag-handle cursor-move')}>
        <CardTitle className={cn('truncate text-xs font-medium leading-none flex-1 min-w-0', isColoredCard && isLight && 'text-slate-900 font-semibold')}>
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
                  isColoredCard && (isLight ? 'text-slate-900 hover:bg-black/10 hover:text-slate-900' : 'text-white hover:bg-white/20 hover:text-white')
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
              <DropdownMenuItem onClick={onDelete} variant='destructive'>
                <Trash2 className='size-3.5' /> {t('Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className='min-h-0 flex-1 px-2 py-1'>
        {/*
         * CONSIGNA para un `kind` nuevo que AGREGUE/AGRUPE datos (sumar,
         * promediar, agrupar por dimension -- no solo mostrar filas crudas
         * una a una): tiene que pasar por el motor server-side (DuckDB), NO
         * por useWidgetData + calculo en el cliente.
         *
         * Por que: useWidgetData trae filas crudas y las procesa en el
         * navegador -- eso es exactamente lo que congelaba el dashboard con
         * decenas de miles de filas (ver StatWidget/TreeGridWidget antes de
         * la migracion, y el hallazgo real: Intl.NumberFormat sin cache en
         * formatting.ts). Un widget nuevo que agregue en el cliente
         * reintroduce el mismo problema con datasets grandes.
         *
         * Como: seguir el patron de StatWidget (hooks/use-stat-aggregation.ts)
         * o TreeGridWidget (hooks/use-tree-aggregation.ts) -- piden a
         * server/src/services/aggregation-service.ts via POST /aggregate, que
         * ya trae los datos de DuckDB con el filtro empujado a SQL y solo las
         * columnas necesarias (rows-source.ts + column-projection.ts).
         *
         * combo/progress/map/calendar/chart NO agregan -- muestran una fila
         * cruda por punto/barra/pin (ChartWidgetBody incluso tiene su propio
         * cap MAX_CHART_POINTS). Por eso siguen en useWidgetData: es
         * apropiado para ellos, no hace falta migrarlos. Si alguno empieza a
         * agrupar/sumar en el futuro, ahi si aplica esta consigna.
         */}
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
        {widget.kind === 'tree_grid' && (
          <TreeGridWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'calendar' && (
          <CalendarWidget widget={widget} activeFilters={activeFilters} />
        )}
        {widget.kind === 'clock' && <ClockWidget />}
        {widget.kind === 'filter_date' && (
          <DateFilterWidget widget={widget} activeFilters={activeFilters} onChange={onFilterChange} />
        )}
        {widget.kind === 'filter_select' && (
          <SelectFilterWidget
            widget={widget}
            activeFilters={activeFilters}
            onChange={onFilterChange}
          />
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

  // Para graficas (barras, lineas, areas, pie), usamos EXCLUSIVAMENTE useStatAggregation (igual que StatWidget).
  // Esto consulta a DuckDB en 3ms y NUNCA parpadea ni muestra "Aún no hay datos." ni baja 50.000 filas crudas.
  const isAggregatedChart = widget.chartType !== 'table' && !!widget.xKey && !!widget.yKey

  const [cleanXKey, inferredGranoKey] = useMemo(() => {
    if (!widget.xKey) return ['', '']
    const parts = widget.xKey.split(',')
    return [parts[0] || '', parts[1] || '']
  }, [widget.xKey])

  const statQuery = useMemo(
    () => ({
      yKey: widget.yKey ?? null,
      breakdownKey: cleanXKey || null,
      granoKey: widget.granoKey || inferredGranoKey || null,
      aggregation: widget.aggregation ?? undefined,
    }),
    [widget.yKey, cleanXKey, widget.granoKey, inferredGranoKey, widget.aggregation]
  )

  const {
    data: aggResult,
    error: aggError,
    isLoading: aggLoading,
    needsDateFilter: aggNeedsDateFilter,
  } = useStatAggregation(
    widget,
    activeFilters,
    isAggregatedChart ? statQuery : { yKey: null }
  )

  // Solo se consulta useWidgetData para tablas crudas (chartType === 'table')
  const {
    rows: rawRows,
    filteredRows,
    error: rawError,
    isLoading: rawLoading,
    needsDateFilter: rawNeedsDateFilter,
  } = useWidgetData(
    widget,
    activeFilters,
    isAggregatedChart ? undefined : undefined
  )

  const compact = widget.layout.h <= 3

  if (isAggregatedChart) {
    if (aggLoading) return <WidgetLoading />
    if (aggNeedsDateFilter) {
      return <WidgetEmpty text={t('Choose a date range and press Query.')} />
    }
    if (aggError) {
      return <WidgetError error={t('Error fetching data: {{error}}', { error: aggError })} />
    }
    if (!aggResult?.points || aggResult.points.length === 0) {
      return <WidgetEmpty text={t('No data yet.')} />
    }

    const chartData = aggResult.points.map((p) => ({
      [cleanXKey]: p.label,
      [widget.yKey!]: p.value,
      __formatted: p.formatted,
    }))

    return (
      <div className='flex h-full flex-col gap-1'>
        <div className='min-h-0 flex-1'>
          <ResponsiveContainer width='100%' height='100%'>
            {renderChart(
              widget.chartType,
              chartData,
              cleanXKey,
              widget.yKey!,
              [],
              widget.color,
              t,
              compact
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Ruta fallback solo para widgets de tipo tabla cruda (chartType === 'table')
  if (rawLoading) return <WidgetLoading />
  if (rawNeedsDateFilter) {
    return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  }
  if (rawError) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error: rawError })} />
  }
  if (rawRows.length === 0 || filteredRows.length === 0) {
    return <WidgetEmpty text={t('No data yet.')} />
  }

  const columns = filteredRows.length > 0 ? Object.keys(filteredRows[0]) : []
  const { x: xKey, y: yKey } = detectKeys(filteredRows, widget.xKey, widget.yKey)
  const chartData = filteredRows.slice(0, MAX_CHART_POINTS).map((r) => ({
    ...r,
    [yKey]: Number(r[yKey]),
  }))

  return (
    <div className='flex h-full flex-col gap-1'>
      <div className='min-h-0 flex-1'>
        <ResponsiveContainer width='100%' height='100%'>
          {renderChart(widget.chartType, chartData, xKey, yKey, columns, widget.color, t, compact)}
        </ResponsiveContainer>
      </div>
    </div>
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
  const mainColor = getWidgetColorCss(color).solid
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

  const isPercentageKey = /utilidad|margen|porcentaje|pct|percent|rate|tasa/i.test(yKey)

  const formatYValue = (v: number) => {
    if (isPercentageKey) {
      const pctVal = Math.abs(v) <= 1 && v !== 0 ? v * 100 : v
      return `${pctVal.toFixed(1)}%`
    }
    return formatCompactNumber(v)
  }

  const tooltipFormatter = (v: number | string) => {
    const num = Number(v)
    if (isNaN(num)) return String(v)
    if (isPercentageKey) {
      const pctVal = Math.abs(num) <= 1 && num !== 0 ? num * 100 : num
      return `${pctVal.toFixed(2)}%`
    }
    return num.toLocaleString()
  }

  const tooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }
  const chartMargin = compact
    ? { top: 4, right: 4, left: 4, bottom: 4 }
    : { top: 6, right: 12, left: -4, bottom: 0 }
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
    width: 52,
    tickFormatter: formatYValue,
    hide: compact,
  }

  if (chartType === 'line') {
    return (
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip formatter={tooltipFormatter as never} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} itemStyle={{ color: '#0f172a' }} />
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
        <Tooltip formatter={tooltipFormatter as never} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} itemStyle={{ color: '#0f172a' }} />
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
        <Tooltip formatter={tooltipFormatter as never} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} itemStyle={{ color: '#0f172a' }} />
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
      <Tooltip formatter={tooltipFormatter as never} cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} itemStyle={{ color: '#0f172a' }} />
      <Bar dataKey={yKey} fill={mainColor} radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}
