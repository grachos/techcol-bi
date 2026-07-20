import { useMemo } from 'react'
import { runSemanticQuery, useSemanticModel } from '@/lib/semantic-layer'
import type { Measure, Row } from '@/lib/semantic-layer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MetricPreviewProps {
  draft: Measure | null
  rows: Row[]
  previewDimension?: string
}

const PREVIEW_ROW_LIMIT = 8
const DRAFT_NAME = '__preview_draft__'

export function MetricPreview({ draft, rows, previewDimension }: MetricPreviewProps) {
  const model = useSemanticModel()
  const dimensionName = previewDimension ?? model.listDimensions()[0]?.name
  const dimensionLabel = dimensionName ? model.getDimension(dimensionName)?.label : null

  const result = useMemo(() => {
    if (!draft || !draft.expression.trim()) return null
    try {
      return runSemanticQuery(model, rows, {
        metrics: [DRAFT_NAME],
        dimensions: dimensionName ? [dimensionName] : [],
        overrides: [{ ...draft, name: DRAFT_NAME }],
      })
    } catch {
      return null
    }
  }, [draft, rows, dimensionName, model])

  if (!draft || !draft.expression.trim()) return null

  return (
    <div className='space-y-2 rounded-md border p-3'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        Vista previa {dimensionLabel ? `por ${dimensionLabel}` : ''}
      </p>
      {!result ? (
        <p className='text-muted-foreground text-xs'>
          Escribe una fórmula válida para ver la vista previa.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {dimensionName && <TableHead>{dimensionLabel}</TableHead>}
              <TableHead className='text-end'>{draft.label || draft.name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
              <TableRow key={row.key}>
                {dimensionName && (
                  <TableCell>{String(row.dimensionValues[dimensionName] ?? '—')}</TableCell>
                )}
                <TableCell className='text-end tabular-nums'>{row.formatted[DRAFT_NAME]}</TableCell>
              </TableRow>
            ))}
            <TableRow className='font-medium'>
              {dimensionName && <TableCell>Total</TableCell>}
              <TableCell className='text-end tabular-nums'>
                {result.totals.formatted[DRAFT_NAME]}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  )
}
