import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Widget } from '@/lib/dashboard-api'
import { aiApi } from '@/lib/ai-api'
import { LocalStorageMetricsRepository } from '@/lib/semantic-layer'
import type { ActiveFilters } from '@/lib/widget-filters'
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Target,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AiInsightsWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

export function AiInsightsWidget({ widget, activeFilters }: AiInsightsWidgetProps) {
  const promptText = widget.targetLabel?.trim() || ''
  const connectorId = widget.connectorId
  // xKey codifica "desglose,grano" (igual que stat/chart): el desglose es la
  // dimension opcional que la IA usa para atribuir un hallazgo a un grupo; el
  // grano es la unidad hoja que las metricas de nivel hoja (ej. Utilidad %)
  // necesitan para calcularse bien (sin el, salen 100%).
  const [breakdownKey, granoKey] = useMemo(() => {
    if (!widget.xKey) return [null, null] as const
    const [b, g] = widget.xKey.split(',')
    return [b?.trim() || null, g?.trim() || null] as const
  }, [widget.xKey])

  const calculatedMeasures = useMemo(
    () =>
      connectorId
        ? new LocalStorageMetricsRepository(
            `semantic-connector-${connectorId}-metrics`
          ).load()
        : [],
    [connectorId]
  )

  // El analisis depende de los filtros ACTIVOS del dashboard: al cambiarlos, la
  // queryKey cambia y la IA re-analiza con los nuevos numeros.
  const query = useQuery({
    queryKey: [
      'ai-insights',
      connectorId,
      activeFilters,
      breakdownKey,
      granoKey,
      promptText,
    ],
    queryFn: () =>
      aiApi.insights({
        connectorId: connectorId as number,
        activeFilters,
        calculatedMeasures,
        breakdownKey,
        granoKey,
        focus: promptText,
      }),
    enabled: connectorId != null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })

  const insights = query.data?.insights ?? []
  const loading = query.isFetching
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : String(query.error)
    : null

  return (
    <div className="flex h-full w-full flex-col justify-between p-4 bg-gradient-to-br from-primary/5 via-background to-muted/30 rounded-lg border border-border/40">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5 mb-2.5 shrink-0">
        <div className="flex items-center space-x-2 text-primary font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          <span>Resumen de IA Copiloto</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => query.refetch()}
          disabled={loading || connectorId == null}
          title="Regenerar análisis"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {promptText && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium shrink-0">
          <Target className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="truncate">Enfoque: {promptText}</span>
        </div>
      )}

      {connectorId == null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-xs font-medium">
            Asigna un conector a este widget para generar el análisis.
          </span>
        </div>
      ) : loading ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-2 py-4 text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Analizando los datos del dashboard...</span>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-xs font-medium">No se pudo generar el análisis: {error}</span>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200 pr-1">
          {insights.map((line, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-2 rounded-md bg-card/60 p-2 border border-border/30 shadow-2xs"
            >
              {idx === 0 ? (
                <Target className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              ) : /negativ|caída|caida|riesgo|pérdida|perdida|anomal/i.test(line) ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              ) : idx % 2 === 1 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{line}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 border-t border-border/30 pt-2 text-[10px] text-muted-foreground flex items-center justify-between shrink-0">
        <span>Generado por Copiloto BI</span>
        {!loading && !error && insights.length > 0 && (
          <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Actualizado
          </span>
        )}
      </div>
    </div>
  )
}
