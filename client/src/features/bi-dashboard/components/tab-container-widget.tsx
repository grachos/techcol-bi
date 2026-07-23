import React, { useMemo, useState } from 'react'
import type { Widget, ChartType } from '@/lib/dashboard-api'
import type { ActiveFilters } from '@/lib/widget-filters'
import { useStatAggregation } from '@/hooks/use-stat-aggregation'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, LineChart as LineChartIcon, Table as TableIcon, Layers } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCompactNumber, truncateLabel } from '@/lib/format-number'
import { getWidgetColorCss } from '@/lib/dashboard-api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { peekConnectorSemanticModel } from '@/lib/semantic-layer'

interface TabContainerWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

interface TabDef {
  id: string
  name: string
  yKey: string
  xKey: string
  type: 'bar' | 'line' | 'table'
}

export function TabContainerWidget({ widget, activeFilters }: TabContainerWidgetProps) {
  // Autodeteccion de metrica fallback si no hay ninguna configurada
  const fallbackYKey = useMemo(() => {
    if (!widget.connectorId) return ''
    const model = peekConnectorSemanticModel(Number(widget.connectorId))
    if (!model) return ''
    const measures = model.listMeasures()
    return measures[0]?.name || ''
  }, [widget.connectorId])

  // Parsea las pestanas configuradas (nombres, metricas y dimensiones separadas por coma)
  const tabDefs = useMemo<TabDef[]>(() => {
    const rawNames = widget.targetLabel
      ? widget.targetLabel.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const rawYKeys = widget.yKey
      ? widget.yKey.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const rawXKeys = widget.xKey
      ? widget.xKey.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const rawTypes = widget.chartType
      ? (widget.chartType.split(',').map((s) => s.trim()) as ChartType[])
      : []

    const defaultY = rawYKeys[0] || fallbackYKey || ''
    const defaultX = rawXKeys[0] || ''

    // Modo por defecto si no se especificaron multiples pestanas: 3 vistas (Barras, Lineas, Tabla)
    if (rawYKeys.length <= 1 && rawXKeys.length <= 1 && rawNames.length <= 1) {
      const baseName = rawNames[0] ? `${rawNames[0]} - ` : ''
      return [
        { id: 'tab-0', name: `${baseName}Barras`, yKey: defaultY, xKey: defaultX, type: 'bar' },
        { id: 'tab-1', name: `${baseName}Líneas`, yKey: defaultY, xKey: defaultX, type: 'line' },
        { id: 'tab-2', name: `${baseName}Tabla`, yKey: defaultY, xKey: defaultX, type: 'table' },
      ]
    }

    // Modo avanzado: pestana personalizada con su propia metrica, dimension y tipo
    const count = Math.max(rawNames.length, rawYKeys.length, rawXKeys.length)
    const result: TabDef[] = []
    for (let i = 0; i < count; i++) {
      const name = rawNames[i] || `Pestaña ${i + 1}`
      const yKey = rawYKeys[i] || defaultY
      const xKey = rawXKeys[i] || defaultX
      const rawType = rawTypes[i] || (i === 0 ? 'bar' : i === 1 ? 'line' : 'table')
      const type: 'bar' | 'line' | 'table' =
        rawType === 'line' ? 'line' : rawType === 'table' ? 'table' : 'bar'
      result.push({ id: `tab-${i}`, name, yKey, xKey, type })
    }
    return result
  }, [widget.targetLabel, widget.yKey, widget.xKey, widget.chartType, fallbackYKey])

  const [activeTabId, setActiveTabId] = useState<string>('tab-0')
  const currentTab = useMemo(() => {
    return tabDefs.find((t) => t.id === activeTabId) || tabDefs[0]
  }, [tabDefs, activeTabId])

  const [cleanXKey, inferredGranoKey] = useMemo(() => {
    if (!currentTab.xKey) return ['', '']
    const parts = currentTab.xKey.split(',')
    return [parts[0] || '', parts[1] || '']
  }, [currentTab.xKey])

  const statQuery = useMemo(
    () => ({
      yKey: currentTab.yKey || null,
      breakdownKey: cleanXKey || null,
      granoKey: widget.granoKey || inferredGranoKey || null,
      aggregation: widget.aggregation ?? 'sum',
    }),
    [currentTab.yKey, cleanXKey, widget.granoKey, inferredGranoKey, widget.aggregation]
  )

  const { data, error, isLoading, needsDateFilter } = useStatAggregation(
    widget,
    activeFilters,
    currentTab.yKey ? statQuery : { yKey: null }
  )

  const mainColor = getWidgetColorCss(widget.color).solid

  if (isLoading) return <WidgetLoading />
  if (needsDateFilter) return <WidgetEmpty text="Elige un rango de fechas y presiona Consultar." />
  if (error) return <WidgetError error={`Error al obtener datos: ${error}`} />
  if (!currentTab.yKey) return <WidgetEmpty text="Configura la columna de valor (Eje Y) en Editar Widget." />
  if (!data?.points || data.points.length === 0) return <WidgetEmpty text="Aún no hay datos para mostrar." />

  const points = data.points
  const xKeyStr = cleanXKey || 'Categoría'
  const yKeyStr = currentTab.yKey

  const chartData = points.map((p) => ({
    [xKeyStr]: p.label,
    [yKeyStr]: p.value,
  }))

  return (
    <div className="flex h-full w-full flex-col p-2 min-h-[160px]">
      <Tabs
        value={activeTabId}
        onValueChange={(v) => setActiveTabId(v)}
        className="flex h-full w-full flex-col"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0 gap-2 overflow-x-auto">
          <TabsList className="flex h-7 bg-muted/60 p-0.5 w-auto">
            {tabDefs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-[11px] px-2.5 py-0.5 flex items-center gap-1.5 font-medium whitespace-nowrap"
              >
                {tab.type === 'bar' ? (
                  <BarChart3 className="h-3 w-3" />
                ) : tab.type === 'line' ? (
                  <LineChartIcon className="h-3 w-3" />
                ) : tab.type === 'table' ? (
                  <TableIcon className="h-3 w-3" />
                ) : (
                  <Layers className="h-3 w-3" />
                )}
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <span className="text-[10px] text-muted-foreground font-medium truncate shrink-0">
            {data.rowCount.toLocaleString()} registros ({yKeyStr})
          </span>
        </div>

        <div className="flex-1 h-full w-full min-h-0 pt-2">
          {currentTab.type === 'bar' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey={xKeyStr}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncateLabel(v, 8)}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => formatCompactNumber(v)}
                />
                <Tooltip />
                <Bar dataKey={yKeyStr} fill={mainColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {currentTab.type === 'line' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey={xKeyStr}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncateLabel(v, 8)}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => formatCompactNumber(v)}
                />
                <Tooltip />
                <Line type="monotone" dataKey={yKeyStr} stroke={mainColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {currentTab.type === 'table' && (
            <div className="h-full w-full overflow-auto rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-[11px]">
                    <TableHead className="font-semibold">{xKeyStr}</TableHead>
                    <TableHead className="text-right font-semibold">{yKeyStr}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {points.map((p, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/20">
                      <TableCell className="font-medium py-1.5">{p.label}</TableCell>
                      <TableCell className="text-right font-mono py-1.5">
                        {p.formatted ?? p.value.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}
