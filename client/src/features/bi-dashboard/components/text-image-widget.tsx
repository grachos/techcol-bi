import React from 'react'
import type { Widget } from '@/lib/dashboard-api'

interface TextImageWidgetProps {
  widget: Widget
}

export function TextImageWidget({ widget }: TextImageWidgetProps) {
  const content = widget.targetLabel || 'Añade tu texto o descripción aquí...'
  const imageUrl = widget.xKey || null

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-auto p-4 text-foreground">
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-2">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {content}
        </div>
      </div>
      {imageUrl && (
        <div className="mt-3 flex items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-2">
          <img
            src={imageUrl}
            alt={widget.title || 'Imagen del widget'}
            className="max-h-48 w-full object-contain transition-transform duration-200 hover:scale-105"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      )}
    </div>
  )
}
