import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { biApi, type Connector } from '@/lib/bi-api'
import {
  AGGREGATIONS,
  CHART_TYPES,
  dashboardApi,
  KINDS_REQUIRING_CONNECTOR,
  WIDGET_COLOR_CSS,
  WIDGET_COLORS,
  WIDGET_KINDS,
  type Aggregation,
  type ChartType,
  type Widget,
  type WidgetColor,
  type WidgetKind,
  type WidgetLayout,
} from '@/lib/dashboard-api'
import { cn } from '@/lib/utils'
import { type WidgetEditSuggestion, type WidgetSuggestion } from '@/lib/ai-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_CONNECTOR_VALUE = '__none__'
const AUTO_VALUE = '__auto__'

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  area: 'Area chart',
  pie: 'Pie chart',
  table: 'Table',
}

const WIDGET_KIND_LABELS: Record<WidgetKind, string> = {
  chart: 'Chart',
  stat: 'KPI card',
  combo: 'Combined chart',
  progress: 'Progress bars',
  map: 'Map',
  calendar: 'Calendar',
  clock: 'Clock',
  filter_date: 'Date filter',
  filter_select: 'Selection filter',
}

const WIDGET_COLOR_LABELS: Record<WidgetColor, string> = {
  primary: 'Default',
  pink: 'Pink',
  blue: 'Blue',
  green: 'Green',
  orange: 'Orange',
  purple: 'Purple',
  teal: 'Teal',
}

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Minimum',
  max: 'Maximum',
}

const DEFAULT_LAYOUT: Record<WidgetKind, WidgetLayout> = {
  chart: { x: 0, y: 0, w: 4, h: 6 },
  stat: { x: 0, y: 0, w: 3, h: 3 },
  combo: { x: 0, y: 0, w: 5, h: 7 },
  progress: { x: 0, y: 0, w: 4, h: 6 },
  map: { x: 0, y: 0, w: 6, h: 8 },
  calendar: { x: 0, y: 0, w: 4, h: 8 },
  clock: { x: 0, y: 0, w: 3, h: 3 },
  filter_date: { x: 0, y: 0, w: 3, h: 3 },
  filter_select: { x: 0, y: 0, w: 3, h: 3 },
}

// Kinds que tienen concepto de color (no aplica a reloj/calendario/filtros)
const KINDS_WITH_COLOR: WidgetKind[] = [
  'chart',
  'stat',
  'combo',
  'progress',
  'map',
]

// Kinds que usan columnas X/Y (eje/categoria y valor)
const KINDS_WITH_XY: WidgetKind[] = ['chart', 'combo', 'progress', 'map']

/**
 * Selector de columna: si ya conocemos las columnas reales del conector
 * (via una muestra de datos), se muestran en un Select; si no, cae a un
 * input de texto libre (ej. conector aun no elegido, o el fetch fallo).
 */
function ColumnField({
  id,
  value,
  onChange,
  columns,
  columnsLoading,
  allowAuto,
  autoLabel,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  columns: string[]
  columnsLoading: boolean
  allowAuto?: boolean
  autoLabel: string
  placeholder: string
}) {
  if (columns.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={columnsLoading}
      />
    )
  }

  return (
    <Select
      value={value || (allowAuto ? AUTO_VALUE : '')}
      onValueChange={(v) => onChange(v === AUTO_VALUE ? '' : v)}
    >
      <SelectTrigger id={id} className='w-full'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAuto && <SelectItem value={AUTO_VALUE}>{autoLabel}</SelectItem>}
        {columns.map((col) => (
          <SelectItem key={col} value={col}>
            {col}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface WidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: number
  connectors: Connector[]
  /** presente => editar; ausente => crear */
  widget?: Widget
  /** sugerencia del copiloto de IA para pre-llenar el formulario al crear */
  aiSuggestion?: WidgetSuggestion
  /** parche del copiloto de IA para pre-llenar el formulario al editar */
  aiEditSuggestion?: WidgetEditSuggestion
  onSaved: () => void
}

export function WidgetDialog({
  open,
  onOpenChange,
  dashboardId,
  connectors,
  widget,
  aiSuggestion,
  aiEditSuggestion,
  onSaved,
}: WidgetDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!widget
  const [kind, setKind] = useState<WidgetKind>('chart')
  const [title, setTitle] = useState('')
  const [connectorId, setConnectorId] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [color, setColor] = useState<WidgetColor>('primary')
  const [xKey, setXKey] = useState('')
  const [yKey, setYKey] = useState('')
  const [aggregation, setAggregation] = useState<Aggregation>('sum')
  const [filterColumn, setFilterColumn] = useState('')
  const [saving, setSaving] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (widget) {
      const patch = aiEditSuggestion?.patch ?? {}
      setKind(widget.kind)
      setTitle(patch.title ?? widget.title)
      setConnectorId(widget.connectorId ? String(widget.connectorId) : '')
      setChartType(patch.chartType ?? widget.chartType)
      setColor(patch.color ?? widget.color)
      setXKey((patch.xKey ?? widget.xKey) ?? '')
      setYKey((patch.yKey ?? widget.yKey) ?? '')
      setAggregation(patch.aggregation ?? widget.aggregation ?? 'sum')
      setFilterColumn(patch.filterColumn ?? widget.filterColumn ?? '')
    } else if (aiSuggestion) {
      setKind('chart')
      setTitle(aiSuggestion.title)
      setConnectorId(String(aiSuggestion.connectorId))
      setChartType(aiSuggestion.chartType)
      setColor(aiSuggestion.color ?? 'primary')
      setXKey(aiSuggestion.xKey ?? '')
      setYKey(aiSuggestion.yKey ?? '')
      setAggregation('sum')
      setFilterColumn('')
    } else {
      setKind('chart')
      setTitle('')
      setConnectorId(connectors[0] ? String(connectors[0].id) : '')
      setChartType('bar')
      setColor('primary')
      setXKey('')
      setYKey('')
      setAggregation('sum')
      setFilterColumn('')
    }
  }, [open, widget, aiSuggestion, aiEditSuggestion, connectors])

  // Trae una muestra de datos del conector elegido para conocer sus columnas reales
  useEffect(() => {
    if (!open || !connectorId) {
      setColumns([])
      return
    }
    let cancelled = false
    setColumnsLoading(true)
    biApi
      .data(Number(connectorId))
      .then((result) => {
        if (cancelled) return
        const rows = Array.isArray(result.data) ? result.data : []
        const firstRow = rows.find(
          (r): r is Record<string, unknown> =>
            typeof r === 'object' && r !== null
        )
        setColumns(firstRow ? Object.keys(firstRow) : [])
      })
      .catch(() => {
        if (!cancelled) setColumns([])
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, connectorId])

  const needsConnector = KINDS_REQUIRING_CONNECTOR.includes(kind)
  const allowsOptionalConnector = kind === 'calendar' || kind === 'filter_date'
  const hasColor = KINDS_WITH_COLOR.includes(kind)
  const hasXY = KINDS_WITH_XY.includes(kind)

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning(t('Give the widget a title'))
      return
    }
    if (needsConnector && !connectorId) {
      toast.warning(t('This widget type requires a connector'))
      return
    }
    if (kind === 'filter_date' || kind === 'filter_select') {
      if (!filterColumn.trim()) {
        toast.warning(t('Give the filter a target column'))
        return
      }
    }

    // xKey: charts/combo/progress/map + calendar; yKey: charts/combo/progress/map + stat
    const wantsXKey = hasXY || kind === 'calendar'
    const wantsYKey = hasXY || kind === 'stat'

    setSaving(true)
    try {
      if (isEdit) {
        await dashboardApi.updateWidget(dashboardId, widget.id, {
          title,
          chartType: kind === 'chart' ? chartType : undefined,
          color: hasColor ? color : undefined,
          xKey: wantsXKey ? xKey || null : undefined,
          yKey: wantsYKey ? yKey || null : undefined,
          aggregation: kind === 'stat' ? aggregation : undefined,
          filterColumn:
            kind === 'filter_date' || kind === 'filter_select'
              ? filterColumn
              : undefined,
        })
        toast.success(t('Widget updated'))
      } else {
        await dashboardApi.addWidget(dashboardId, {
          connectorId: connectorId ? Number(connectorId) : null,
          title,
          kind,
          chartType: kind === 'chart' ? chartType : undefined,
          color: hasColor ? color : undefined,
          xKey: wantsXKey ? xKey || null : undefined,
          yKey: wantsYKey ? yKey || null : undefined,
          aggregation: kind === 'stat' ? aggregation : undefined,
          filterColumn:
            kind === 'filter_date' || kind === 'filter_select'
              ? filterColumn
              : undefined,
          layout: DEFAULT_LAYOUT[kind],
        })
        toast.success(t('Widget added'))
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('Edit widget') : t('Add widget')}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {!isEdit && aiSuggestion?.explanation && (
            <div className='bg-muted/50 flex items-start gap-2 rounded-md border p-3 text-sm'>
              <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' />
              <p className='text-muted-foreground'>
                {aiSuggestion.explanation}
              </p>
            </div>
          )}
          {isEdit && aiEditSuggestion?.explanation && (
            <div className='bg-muted/50 flex items-start gap-2 rounded-md border p-3 text-sm'>
              <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' />
              <p className='text-muted-foreground'>
                {aiEditSuggestion.explanation}
              </p>
            </div>
          )}

          {!isEdit && (
            <div className='space-y-2'>
              <Label>{t('Widget type')}</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as WidgetKind)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(WIDGET_KIND_LABELS[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='widget-title'>{t('Title')}</Label>
            <Input
              id='widget-title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Sales by month')}
            />
          </div>

          {kind !== 'clock' && (
            <div className='space-y-2'>
              <Label>{t('Connector')}</Label>
              <Select
                value={connectorId || NO_CONNECTOR_VALUE}
                onValueChange={(v) =>
                  setConnectorId(v === NO_CONNECTOR_VALUE ? '' : v)
                }
                disabled={isEdit}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder={t('Choose a connector')} />
                </SelectTrigger>
                <SelectContent>
                  {allowsOptionalConnector && (
                    <SelectItem value={NO_CONNECTOR_VALUE}>
                      {t('None')}
                    </SelectItem>
                  )}
                  {connectors.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {connectorId && columns.length === 0 && !columnsLoading && (
                <p className='text-muted-foreground text-xs'>
                  {t(
                    "Could not detect this connector's columns; type the column name manually."
                  )}
                </p>
              )}
            </div>
          )}

          {hasColor && (
            <div className='space-y-2'>
              <Label>{t('Color')}</Label>
              <div className='flex flex-wrap gap-2'>
                {WIDGET_COLORS.map((c) => (
                  <button
                    key={c}
                    type='button'
                    onClick={() => setColor(c)}
                    title={t(WIDGET_COLOR_LABELS[c])}
                    className={cn(
                      'size-7 rounded-full border-2 transition',
                      color === c
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    )}
                    style={{ background: WIDGET_COLOR_CSS[c].solid }}
                  >
                    <span className='sr-only'>{t(WIDGET_COLOR_LABELS[c])}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'chart' && (
            <div className='space-y-2'>
              <Label>{t('Chart type')}</Label>
              <Select
                value={chartType}
                onValueChange={(v) => setChartType(v as ChartType)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {t(CHART_TYPE_LABELS[ct])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {((kind === 'chart' && chartType !== 'table') || kind === 'combo') && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('X axis column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Y axis column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'progress' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('Label column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Value column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'map' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-xkey'>
                  {t('Region column (country)')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-xkey'
                  value={xKey}
                  onChange={setXKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>
                  {t('Value column')}{' '}
                  <span className='text-muted-foreground'>
                    {t('(optional)')}
                  </span>
                </Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  allowAuto
                  autoLabel={t('Auto-detect')}
                  placeholder={t('Auto-detect')}
                />
              </div>
            </div>
          )}

          {kind === 'stat' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='widget-ykey'>{t('Column to aggregate')}</Label>
                <ColumnField
                  id='widget-ykey'
                  value={yKey}
                  onChange={setYKey}
                  columns={columns}
                  columnsLoading={columnsLoading}
                  autoLabel={t('Auto-detect')}
                  placeholder={t('e.g. total_millones')}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Aggregation')}</Label>
                <Select
                  value={aggregation}
                  onValueChange={(v) => setAggregation(v as Aggregation)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(AGGREGATION_LABELS[a])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {kind === 'calendar' && (
            <div className='space-y-2'>
              <Label htmlFor='widget-xkey'>
                {t('Date column to highlight')}{' '}
                <span className='text-muted-foreground'>
                  {t('(optional)')}
                </span>
              </Label>
              <ColumnField
                id='widget-xkey'
                value={xKey}
                onChange={setXKey}
                columns={columns}
                columnsLoading={columnsLoading}
                allowAuto
                autoLabel={t('None')}
                placeholder={t('e.g. created_at')}
              />
            </div>
          )}

          {(kind === 'filter_date' || kind === 'filter_select') && (
            <div className='space-y-2'>
              <Label htmlFor='widget-filter-column'>
                {t('Target column')}
              </Label>
              <ColumnField
                id='widget-filter-column'
                value={filterColumn}
                onChange={setFilterColumn}
                columns={columns}
                columnsLoading={columnsLoading}
                autoLabel={t('Auto-detect')}
                placeholder={t('e.g. created_at')}
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Widgets on this dashboard that share this column will be filtered automatically.'
                )}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving…') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
