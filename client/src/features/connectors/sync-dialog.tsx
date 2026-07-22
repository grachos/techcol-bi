import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { toast } from 'sonner'
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { biApi, type Connector } from '@/lib/bi-api'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const NONE_VALUE = '__none__'

interface SyncDialogProps {
  connector: Connector | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Recarga la lista de conectores (para reflejar date_column/etc. recien guardados) */
  onSaved: () => void
}

/**
 * Configura la sincronizacion hacia DuckDB de un conector y la dispara a
 * mano. La columna de fecha es OPCIONAL a proposito: no todas las fuentes
 * tienen un campo de fecha (ej. un catalogo de usuarios), y sin ella el sync
 * simplemente hace full refresh cada vez -- sigue siendo valido, solo sin
 * incremental.
 */
export function SyncDialog({ connector, open, onOpenChange, onSaved }: SyncDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? es : enUS
  const status = useSyncStatus(open ? connector?.id : null)

  const [columns, setColumns] = useState<string[]>([])
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [dateColumn, setDateColumn] = useState(NONE_VALUE)
  const [windowDays, setWindowDays] = useState('30')
  const [intervalMinutes, setIntervalMinutes] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!connector) return
    setDateColumn(connector.date_column ?? NONE_VALUE)
    setWindowDays(String(connector.sync_window_days ?? 30))
    setIntervalMinutes(
      connector.sync_interval_minutes != null ? String(connector.sync_interval_minutes) : ''
    )
  }, [connector])

  // Columnas reales de la fuente: mismo "Probar" que ya usa el boton Test,
  // asi el selector de fecha ofrece nombres reales, no texto libre.
  useEffect(() => {
    if (!open || !connector) return
    setLoadingColumns(true)
    biApi
      .test(connector.id)
      .then((r) => setColumns(r.columns ?? []))
      .catch(() => setColumns([]))
      .finally(() => setLoadingColumns(false))
  }, [open, connector])

  if (!connector) return null

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      await biApi.syncConfig(connector.id, {
        dateColumn: dateColumn === NONE_VALUE ? null : dateColumn,
        syncWindowDays: Number(windowDays) || 30,
        syncIntervalMinutes: intervalMinutes ? Number(intervalMinutes) : null,
      })
      toast.success(t('Sync settings saved'))
      onSaved()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const range = from || to ? { from: from || to, to: to || from } : undefined
      const result = await biApi.sync(connector.id, range)
      if (result.status === 'error') {
        toast.error(result.error ?? t('Sync failed'))
      } else {
        toast.success(t('Synced {{n}} rows', { n: result.rowCount ?? 0 }))
      }
      status.refetch()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSyncing(false)
    }
  }

  const s = status.data
  const isSyncing = syncing || s?.status === 'syncing'
  // Primer sync sin watermark todavia: si la fuente exige fecha (ej. APIs que
  // responden error sin rango), hace falta un rango explicito para el
  // backfill inicial -- se avisa en vez de dejar que falle en silencio.
  const needsFirstRange = dateColumn !== NONE_VALUE && !s?.last_sync_at

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('Sync')} — {connector.name}</DialogTitle>
          <DialogDescription>
            {t('Controls when this connector\'s data in the local store gets refreshed.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-w-full overflow-hidden">
          {/* Estado actual */}
          <div className="flex items-start gap-2 rounded-md border p-3 text-sm max-w-full overflow-hidden">
            {isSyncing ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground mt-0.5" />
            ) : s?.status === 'error' ? (
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              {isSyncing ? (
                <span>{t('Syncing…')}</span>
              ) : s?.last_sync_at ? (
                <span>
                  {t('Updated {{time}} ago', {
                    time: formatDistanceToNow(new Date(s.last_sync_at), { locale }),
                  })}
                  {s.row_count != null && ` · ${t('{{n}} rows', { n: s.row_count })}`}
                </span>
              ) : (
                <span className="text-muted-foreground">{t('Never synced — data comes live on each load until then.')}</span>
              )}
              {s?.status === 'error' && s.last_error && (
                <p className="break-words whitespace-pre-wrap max-h-36 overflow-y-auto mt-1 text-xs text-destructive font-mono bg-destructive/5 p-2 rounded border border-destructive/20">
                  {s.last_error}
                </p>
              )}
            </div>
          </div>

          {/* Columna de fecha (opcional) */}
          <div className="space-y-2">
            <Label>{t('Date column')}</Label>
            <Select value={dateColumn} onValueChange={setDateColumn}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingColumns ? t('Detecting columns…') : undefined} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t('None — always full refresh')}</SelectItem>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('Only if this source has a date field. Enables incremental sync instead of re-fetching everything.')}
            </p>
          </div>

          {dateColumn !== NONE_VALUE && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('Re-read window (days)')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={windowDays}
                  onChange={(e) => setWindowDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('Re-checks this many days back on every sync, in case old rows changed status.')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('Auto-sync every (minutes)')}</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={t('Manual only')}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                />
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? t('Saving…') : t('Save sync settings')}
          </Button>

          <div className="border-t pt-4 space-y-3">
            {needsFirstRange && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t('First sync with a date column: give it an explicit range below. Sources that require a date filter fail on an empty one.')}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">{t('From')} {t('(optional)')}</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('To')} {t('(optional)')}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`me-2 size-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('Syncing…') : t('Sync now')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
