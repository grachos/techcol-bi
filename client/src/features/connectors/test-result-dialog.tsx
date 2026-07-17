import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { type ConnectorTestResult } from '@/lib/bi-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TestResultDialogProps {
  connectorName: string
  result: ConnectorTestResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Celda: los objetos/arrays anidados se muestran como JSON compacto. */
function renderCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Resultado de probar un conector: ademas de decir si conecta, muestra las
 * columnas y las primeras filas. Es lo que el usuario necesita para saber
 * que poner en los ejes/columnas de los widgets, sin adivinar.
 */
export function TestResultDialog({
  connectorName,
  result,
  open,
  onOpenChange,
}: TestResultDialogProps) {
  const { t } = useTranslation()
  if (!result) return null

  const copyColumns = () => {
    navigator.clipboard.writeText(result.columns.join(', '))
    toast.success(t('Columns copied'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {result.ok ? (
              <CheckCircle2 className='size-5 text-emerald-600' />
            ) : (
              <XCircle className='text-destructive size-5' />
            )}
            {connectorName}
          </DialogTitle>
          <DialogDescription>
            {result.ok
              ? t('{{count}} rows returned. Showing the first {{shown}}.', {
                  count: result.rowCount,
                  shown: result.rows.length,
                })
              : t('The connection failed.')}
            {result.params?.from && (
              <>
                {' '}
                {t('Tested with {{from}} to {{to}}.', {
                  from: result.params.from,
                  to: result.params.to,
                })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!result.ok && (
          <div className='space-y-3'>
            <div className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'>
              {result.error}
            </div>
            {result.received && (
              <div className='space-y-1'>
                <p className='text-muted-foreground text-xs'>
                  {t('The source replied with:')}
                </p>
                <pre className='bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-xs'>
                  {result.received}
                </pre>
              </div>
            )}
          </div>
        )}

        {result.ok && result.columns.length > 0 && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>
                  {t('Available columns')} ({result.columns.length})
                </p>
                <Button variant='ghost' size='sm' onClick={copyColumns}>
                  <Copy className='me-1 size-3.5' />
                  {t('Copy')}
                </Button>
              </div>
              <div className='flex max-h-28 flex-wrap gap-1 overflow-y-auto'>
                {result.columns.map((c) => (
                  <Badge key={c} variant='secondary' className='font-mono text-xs'>
                    {c}
                  </Badge>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('Sample rows')}</p>
              {/* La tabla scrollea dentro de su contenedor: estas fuentes
                  pueden traer decenas de columnas y no debe empujar el dialogo */}
              <div className='max-h-72 overflow-auto rounded-md border'>
                <Table>
                  <TableHeader className='bg-muted sticky top-0'>
                    <TableRow>
                      {result.columns.map((c) => (
                        <TableHead key={c} className='font-mono text-xs whitespace-nowrap'>
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i}>
                        {result.columns.map((c) => (
                          <TableCell
                            key={c}
                            className='max-w-48 truncate text-xs whitespace-nowrap'
                            title={renderCell(row[c])}
                          >
                            {renderCell(row[c])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {result.ok && result.columns.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            {t('The connection works, but the source returned no rows.')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
