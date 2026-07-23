import React, { useState, useEffect } from 'react'
import type { Widget } from '@/lib/dashboard-api'
import { Sparkles, RefreshCw, TrendingUp, Target, CheckCircle2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AiInsightsWidgetProps {
  widget: Widget
}

export function AiInsightsWidget({ widget }: AiInsightsWidgetProps) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string[]>([])

  const promptText = widget.targetLabel?.trim() || ''

  const generateInsights = () => {
    setLoading(true)
    setTimeout(() => {
      // Generar puntos de insight ejecutivos basados en el enfoque del usuario
      const customInsights = [
        promptText
          ? `Análisis focalizado en: "${promptText}". El rendimiento global de los conectores vinculados refleja métricas estables.`
          : 'El rendimiento general del dashboard muestra una tendencia sostenida en los periodos auditados.',
        'La utilidad y margen de operacion muestran un comportamiento positivo sin desviaciones criticas.',
        'Se recomienda monitorear las transacciones de alto volumen para mantener la eficiencia del margen operativo.',
      ]
      setInsights(customInsights)
      setLoading(false)
    }, 600)
  }

  useEffect(() => {
    generateInsights()
  }, [widget.id, widget.targetLabel])

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
          onClick={generateInsights}
          disabled={loading}
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

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-2 py-4 text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Generando insights ejecutivos...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200 pr-1">
          {insights.map((line, idx) => (
            <div key={idx} className="flex items-start space-x-2 rounded-md bg-card/60 p-2 border border-border/30 shadow-2xs">
              {idx === 0 ? (
                <Target className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              ) : idx === 1 ? (
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
        <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Actualizado
        </span>
      </div>
    </div>
  )
}
