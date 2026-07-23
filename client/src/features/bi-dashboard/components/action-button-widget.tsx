import React from 'react'
import type { Widget } from '@/lib/dashboard-api'
import { Button } from '@/components/ui/button'
import { RotateCcw, Printer, Download, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { biApi } from '@/lib/bi-api'

interface ActionButtonWidgetProps {
  widget: Widget
  onClearFilters?: () => void
}

const ACTION_LABELS: Record<string, string> = {
  clear_filters: 'Reiniciar Filtros',
  export_pdf: 'Imprimir / Exportar PDF',
  refresh_data: 'Actualizar Datos',
  export_excel: 'Exportar a Excel',
}

export function ActionButtonWidget({ widget, onClearFilters }: ActionButtonWidgetProps) {
  const actionType = widget.targetLabel || 'clear_filters'

  // Si el titulo es generico o coincide con "Prueba", "Widget", usar la etiqueta de la accion
  const defaultLabel = ACTION_LABELS[actionType] || 'Ejecutar Acción'
  const buttonText =
    widget.title && !/^(prueba|widget|nuevo|sin título)\b/i.test(widget.title.trim())
      ? widget.title
      : defaultLabel

  const extractRowsFromResult = (res: unknown): Record<string, unknown>[] => {
    if (!res || typeof res !== 'object') return []
    const obj = res as Record<string, unknown>
    if (Array.isArray(obj.data) && obj.data.length > 0) {
      return obj.data as Record<string, unknown>[]
    }
    if (Array.isArray(obj.rows) && obj.rows.length > 0) {
      return obj.rows as Record<string, unknown>[]
    }
    return []
  }

  const triggerCsvDownload = async () => {
    try {
      toast.info('Generando archivo de Excel/CSV...')

      let rows: Record<string, unknown>[] = []
      const targetConnectorId = widget.connectorId

      // 1. Si el widget tiene conector asignado, intentar obtener sus datos
      if (targetConnectorId) {
        try {
          const resData = await biApi.data(targetConnectorId)
          rows = extractRowsFromResult(resData)
        } catch {
          try {
            const resTest = await biApi.test(targetConnectorId)
            rows = extractRowsFromResult(resTest)
          } catch {
            // ignore
          }
        }
      }

      // 2. Si no habia conector asignado o no devolvio filas, consultar los conectores del sistema
      if (rows.length === 0) {
        const connectorsList = await biApi.list().catch(() => [])
        for (const c of connectorsList) {
          try {
            const resData = await biApi.data(c.id)
            rows = extractRowsFromResult(resData)
            if (rows.length > 0) break
          } catch {
            try {
              const resTest = await biApi.test(c.id)
              rows = extractRowsFromResult(resTest)
              if (rows.length > 0) break
            } catch {
              // ignore
            }
          }
        }
      }

      // 3. Fallback adicional: extraer filas de elementos <table> en el DOM si existen
      if (rows.length === 0) {
        const tableElements = document.querySelectorAll('table')
        tableElements.forEach((table) => {
          const headers: string[] = []
          table.querySelectorAll('th').forEach((th) => headers.push(th.innerText.trim()))

          table.querySelectorAll('tbody tr').forEach((tr) => {
            const rowObj: Record<string, unknown> = {}
            const cells = tr.querySelectorAll('td')
            cells.forEach((td, idx) => {
              const h = headers[idx] || `Columna_${idx + 1}`
              rowObj[h] = td.innerText.trim()
            })
            if (Object.keys(rowObj).length > 0) {
              rows.push(rowObj)
            }
          })
        })
      }

      if (rows.length === 0) {
        toast.warning('No se encontraron datos en los conectores para exportar.')
        return
      }

      // Construir contenido CSV compatible con Microsoft Excel (BOM UTF-8 \uFEFF)
      const keys = Object.keys(rows[0])
      const headerLine = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(',')

      const dataLines = rows.map((r) =>
        keys
          .map((k) => {
            const val = r[k] ?? ''
            return `"${String(val).replace(/"/g, '""')}"`
          })
          .join(',')
      )

      const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `exportacion_bi_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exportación completada (${rows.length.toLocaleString()} registros descargados)`)
    } catch (err) {
      toast.error('Error al exportar los datos: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleAction = () => {
    switch (actionType) {
      case 'clear_filters':
        if (onClearFilters) {
          onClearFilters()
        }
        toast.success('Filtros del dashboard reiniciados')
        break

      case 'export_pdf':
        toast.info('Preparando vista de impresión/PDF...')
        setTimeout(() => {
          window.print()
        }, 300)
        break

      case 'refresh_data':
        toast.success('Actualizando datos...')
        window.location.reload()
        break

      case 'export_excel':
        triggerCsvDownload()
        break

      default:
        if (onClearFilters) {
          onClearFilters()
        }
        toast.success(`Acción realizada: ${buttonText}`)
        break
    }
  }

  const renderIcon = () => {
    switch (actionType) {
      case 'clear_filters':
        return <RotateCcw className="mr-2 h-4 w-4 shrink-0" />
      case 'export_pdf':
        return <Printer className="mr-2 h-4 w-4 shrink-0" />
      case 'refresh_data':
        return <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
      case 'export_excel':
        return <Download className="mr-2 h-4 w-4 shrink-0" />
      default:
        return <Sparkles className="mr-2 h-4 w-4 shrink-0" />
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Button
        onClick={handleAction}
        className="w-full max-w-xs shadow-sm hover:shadow-md transition-all font-medium flex items-center justify-center"
      >
        {renderIcon()}
        <span className="truncate">{buttonText}</span>
      </Button>
    </div>
  )
}
