import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { biApi } from '@/lib/bi-api'
import { aiApi } from '@/lib/ai-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PreviewQueryDialogProps {
  connectorId: number | null
  query: string
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorType?: 'mysql' | 'postgresql'
  onQueryChange?: (query: string) => void
  schema?: string
}

interface PreviewResult {
  success: boolean
  error?: string
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

interface QuerySuggestion {
  query: string
  explanation: string
}

export function PreviewQueryDialog({
  connectorId,
  query,
  open,
  onOpenChange,
  connectorType = 'mysql',
  onQueryChange,
  schema,
}: PreviewQueryDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [suggestion, setSuggestion] = useState<QuerySuggestion | null>(null)
  const [suggestingFix, setSuggestingFix] = useState(false)

  const handlePreview = async () => {
    if (!connectorId || !query.trim()) {
      return
    }

    setLoading(true)
    try {
      const res = await biApi.preview(connectorId, query)
      setResult(res)
    } catch (error) {
      setResult({
        success: false,
        error: String(error instanceof Error ? error.message : error),
        columns: [],
        rows: [],
        rowCount: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null)
      setSuggestion(null)
    }
    onOpenChange(newOpen)
  }

  const handleSuggestFix = async () => {
    if (!result || result.success || !result.error) {
      return
    }

    setSuggestingFix(true)
    try {
      const fix = await aiApi.fixQuery(query, result.error, connectorType, schema)
      setSuggestion(fix)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSuggestingFix(false)
    }
  }

  const handleAcceptSuggestion = () => {
    if (suggestion && onQueryChange) {
      onQueryChange(suggestion.query)
      toast.success(t('Query updated with suggestion'))
      setResult(null)
      setSuggestion(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Preview Query')}</DialogTitle>
          <DialogDescription>
            {t('Execute the query with a limit of 10 rows to see if it works')}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('Query')}</label>
              <div className="p-3 bg-muted rounded font-mono text-sm overflow-x-auto max-h-32">
                {query}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {t('Note: Queries will be executed with a LIMIT of 10 rows for preview')}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                {t('Cancel')}
              </Button>
              <Button onClick={handlePreview} disabled={loading || !connectorId || !query.trim()}>
                {loading ? t('Executing…') : t('Execute Preview')}
              </Button>
            </DialogFooter>
          </div>
        ) : suggestion ? (
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {t('AI suggested a fix for your query')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('Original Query')}</label>
              <div className="p-3 bg-red-50 rounded font-mono text-xs overflow-x-auto max-h-24 border border-red-200">
                {query}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('Suggested Query')}</label>
              <div className="p-3 bg-green-50 rounded font-mono text-xs overflow-x-auto max-h-24 border border-green-200">
                {suggestion.query}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('Explanation')}</label>
              <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSuggestion(null)}
              >
                {t('Reject')}
              </Button>
              <Button onClick={handleAcceptSuggestion}>
                {t('Accept & Update')}
              </Button>
            </DialogFooter>
          </div>
        ) : result.success ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {t('Query executed successfully. {{count}} rows returned.', {
                  count: result.rowCount,
                })}
              </AlertDescription>
            </Alert>

            {result.rows.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('Results')}</label>
                <div className="overflow-x-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.columns.map((col) => (
                          <TableHead key={col} className="text-xs">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {result.columns.map((col) => (
                            <TableCell key={`${idx}-${col}`} className="text-xs py-2">
                              <div className="max-w-xs truncate">
                                {typeof row[col] === 'object'
                                  ? JSON.stringify(row[col])
                                  : String(row[col] ?? '')}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertDescription>{t('Query returned no results')}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResult(null)}
              >
                {t('Try Again')}
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                {t('Close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.error || t('Unknown error')}</AlertDescription>
            </Alert>

            <div className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-32">
              <div className="text-red-600">{result.error}</div>
            </div>

            <div className="text-xs text-muted-foreground">
              {t('Common issues:')}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('Column name does not exist in the table')}</li>
                <li>{t('Table does not exist or was misspelled')}</li>
                <li>{t('Database connection failed')}</li>
                <li>{t('SQL syntax error in the query')}</li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResult(null)}
              >
                {t('Try Again')}
              </Button>
              <Button
                onClick={handleSuggestFix}
                disabled={suggestingFix}
              >
                {suggestingFix ? (
                  <>
                    <Sparkles className="size-4 mr-2 animate-spin" />
                    {t('Suggesting…')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    {t('Suggest Fix with AI')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
