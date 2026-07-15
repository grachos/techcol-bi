import { useEffect, useMemo, useState } from 'react'
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
import { biApi } from '@/lib/bi-api'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { applyFilters, type ActiveFilterValue, type ActiveFilters } from '@/lib/widget-filters'
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

const REFRESH_MS = 15000
const MAX_TABLE_ROWS = 100
const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

type Row = Record<string, unknown>

function toRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is Row => typeof item === 'object' && item !== null
  )
}

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
  onAiEdit: () => void
  onDelete: () => void
}

export function WidgetCard({
  widget,
  activeFilters,
  onFilterChange,
  onEdit,
  onAiEdit,
  onDelete,
}: WidgetCardProps) {
  const { t } = useTranslation()

  // La tarjeta KPI (stat) va con el fondo de color completo y texto blanco
  const isColoredCard = widget.kind === 'stat' && widget.color !== 'primary'
  const solid = WIDGET_COLOR_CSS[widget.color].solid

  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden',
        isColoredCard && 'border-transparent text-white'
      )}
      style={isColoredCard ? { background: solid } : undefined}
    >
      <CardHeader className='drag-handle flex-none cursor-move flex-row items-center justify-between space-y-0 py-3'>
        <CardTitle className='truncate text-sm font-medium'>
          {widget.title}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className={cn(
                'size-6 shrink-0',
                isColoredCard && 'text-white hover:bg-white/20 hover:text-white'
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical size={14} />
              <span className='sr-only'>{t('Widget options')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className='size-3.5' /> {t('Edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAiEdit}>
              <Sparkles className='size-3.5' /> {t('Edit with AI')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} variant='destructive'>
              <Trash2 className='size-3.5' /> {t('Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className='min-h-0 flex-1 pb-3'>
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
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!widget.connectorId) return
    let cancelled = false
    const fetchData = () => {
      biApi
        .data(widget.connectorId!)
        .then((result) => {
          if (cancelled) return
          setRows(toRows(result.data))
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : String(err))
        })
    }
    fetchData()
    const interval = setInterval(fetchData, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [widget.connectorId])

  const filteredRows = useMemo(
    () => applyFilters(rows, activeFilters),
    [rows, activeFilters]
  )

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

  if (error) {
    return (
      <p className='text-destructive text-xs'>
        {t('Error fetching data: {{error}}', { error })}
      </p>
    )
  }
  if (rows.length === 0) {
    return <p className='text-muted-foreground text-xs'>{t('No data yet.')}</p>
  }
  if (filteredRows.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No rows match the active filters.')}
      </p>
    )
  }

  return (
    <ResponsiveContainer width='100%' height='100%'>
      {renderChart(widget.chartType, chartData, xKey, yKey, columns, widget.color, t)}
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
  t: (key: string, opts?: Record<string, unknown>) => string
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

  if (chartType === 'line') {
    return (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis dataKey={xKey} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
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
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
        <XAxis dataKey={xKey} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
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
    return (
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} />
        <Pie
          data={data}
          dataKey={yKey}
          nameKey={xKey}
          outerRadius='80%'
          label={(entry) => String(entry.name)}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={pieColors[i % pieColors.length]} />
          ))}
        </Pie>
      </PieChart>
    )
  }

  return (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
      <XAxis dataKey={xKey} fontSize={11} tickLine={false} axisLine={false} />
      <YAxis fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} />
      <Bar dataKey={yKey} fill={mainColor} radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}
