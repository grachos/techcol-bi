import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy, TableIcon, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { type ConnectorTestResult, type TableCandidate } from '@/lib/bi-api'
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
  /** Guarda la ruta elegida como 'dataPath' del conector y vuelve a probar. */
  onPickTable?: (path: string) => Promise<void>
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
  onPickTable,
}: TestResultDialogProps) {
  const { t } = useTranslation()
  const [pickingPath, setPickingPath] = useState<string | null>(null)
  if (!result) return null

  const copyColumns = () => {
    navigator.clipboard.writeText(result.columns.join(', '))
    toast.success(t('Columns copied'))
  }

  const handlePick = async (table: TableCandidate) => {
    if (!onPickTable) return
    setPickingPath(table.path)
    try {
      await onPickTable(table.path)
    } finally {
      setPickingPath(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl'>
        <DialogHeader className='shrink-0 border-b px-6 py-4 pe-12'>
          <DialogTitle className='flex items-center gap-2'>
            {result.ok ? (
              <CheckCircle2 className='size-5 shrink-0 text-emerald-600' />
            ) : (
              <XCircle className='text-destructive size-5 shrink-0' />
            )}
            <span className='truncate'>{connectorName}</span>
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

        <div className='flex-1 space-y-4 overflow-y-auto px-6 py-4'>
          {!result.ok && (
            <div className='space-y-3'>
              <div className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'>
                {result.error}
              </div>

              {result.tables && result.tables.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-sm font-medium'>
                    {t('Tables found in the response')}
                  </p>
                  <div className='space-y-2'>
                    {result.tables.map((table) => (
                      <div
                        key={table.path || '(root)'}
                        className='flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
                      >
                        <div className='min-w-0 space-y-1'>
                          <div className='flex items-center gap-2'>
                            <TableIcon className='text-muted-foreground size-4 shrink-0' />
                            <code className='truncate text-sm font-medium'>
                              {table.path || t('(root of the response)')}
                            </code>
                          </div>
                          <p className='text-muted-foreground text-xs'>
                            {t('{{rows}} rows · {{cols}} columns', {
                              rows: table.rowCount,
                              cols: table.columns.length,
                            })}
                            {' — '}
                            {table.columns.slice(0, 4).join(', ')}
                            {table.columns.length > 4 && '…'}
                          </p>
                        </div>
                        <Button
                          size='sm'
                          className='w-full shrink-0 sm:w-auto'
                          disabled={!onPickTable || pickingPath !== null}
                          onClick={() => handlePick(table)}
                        >
                          {pickingPath === table.path
                            ? t('Applying…')
                            : t('Use this table')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.received && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-muted-foreground text-xs'>
                      {t('The source replied with:')}
                    </p>
                    {result.receivedFormat && (
                      <Badge
                        variant='outline'
                        className='shrink-0 font-mono text-[10px] uppercase'
                      >
                        {result.receivedFormat}
                      </Badge>
                    )}
                  </div>
                  <pre className='bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed'>
                    {result.received}
                  </pre>
                  <p className='text-muted-foreground text-xs'>
                    {t('One representative record with all its columns; repeated rows are collapsed. The data path is the key holding the list of rows.')}
                  </p>
                </div>
              )}
            </div>
          )}

          {result.ok && result.columns.length > 0 && (
            <div className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <p className='text-sm font-medium'>
                    {t('Available columns')} ({result.columns.length})
                  </p>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='shrink-0'
                    onClick={copyColumns}
                  >
                    <Copy className='me-1 size-3.5' />
                    {t('Copy')}
                  </Button>
                </div>
                <div className='flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-md border p-2'>
                  {result.columns.map((c) => (
                    <Badge key={c} variant='secondary' className='font-mono text-xs'>
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>{t('Sample rows')}</p>
                {/* Un unico contenedor con scroll (vertical + horizontal): la
                    tabla puede traer decenas de columnas y el encabezado debe
                    quedar fijo sin duplicar el area de scroll */}
                <Table containerClassName='max-h-72 overflow-auto rounded-md border'>
                  <TableHeader className='bg-muted sticky top-0 z-10'>
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
          )}

          {result.ok && result.columns.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              {t('The connection works, but the source returned no rows.')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
