import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles, AlertCircle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AiGenerateSqlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorType: 'mysql' | 'postgresql'
  host: string
  port: string
  user: string
  password: string
  database: string
  onQuery: (query: string) => void
}

export function AiGenerateSqlDialog({
  open,
  onOpenChange,
  connectorType,
  host,
  port,
  user,
  password,
  database,
  onQuery,
}: AiGenerateSqlDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ query: string; explanation: string } | null>(null)
  const [schema, setSchema] = useState<{ tables: Array<{ name: string; columns: string[] }> } | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const connectionComplete =
    host.trim() && user.trim() && database.trim()

  useEffect(() => {
    if (!open || !connectionComplete) {
      setSchema(null)
      setSchemaError(null)
      return
    }

    const fetchSchema = async () => {
      setSchemaLoading(true)
      setSchemaError(null)
      try {
        const res = await fetch('/api/ai/get-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host,
            port: port ? Number(port) : undefined,
            user,
            password,
            database,
            type: connectorType,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || `Error ${res.status}`)
        }
        const data = await res.json()
        setSchema(data)
      } catch (error) {
        setSchemaError(String(error instanceof Error ? error.message : error))
      } finally {
        setSchemaLoading(false)
      }
    }

    fetchSchema()
  }, [open, host, port, user, password, database, connectorType, connectionComplete])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.warning(t('Describe what data you want'))
      return
    }
    setGenerating(true)
    try {
      const schemaDescription = schema
        ? schema.tables
            .map((t) => `${t.name}: [${t.columns.join(', ')}]`)
            .join('\n')
        : ''
      const res = await aiApi.generateSqlWithSchema(
        prompt,
        schemaDescription,
        connectorType
      )
      setResult(res)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = () => {
    if (result?.query) {
      onQuery(result.query)
      setPrompt('')
      setResult(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='size-5' />
            {t('Generate SQL with AI')}
          </DialogTitle>
          <DialogDescription>
            {t('Describe what data you want, and AI will generate the SELECT query.')}
          </DialogDescription>
        </DialogHeader>

        {!connectionComplete ? (
          <Alert variant='destructive'>
            <AlertCircle className='size-4' />
            <AlertDescription>
              {t('Complete the connection details (host, user, password, database) before using AI SQL generation')}
            </AlertDescription>
          </Alert>
        ) : schemaError ? (
          <Alert variant='destructive'>
            <AlertCircle className='size-4' />
            <AlertDescription>{schemaError}</AlertDescription>
          </Alert>
        ) : schemaLoading ? (
          <div className='text-center py-8 text-muted-foreground'>
            {t('Loading database schema…')}
          </div>
        ) : !result ? (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {t('What data do you want?')}
              </label>
              <Textarea
                placeholder={t(
                  'e.g., sales by month where amount > 1000, sorted by date desc'
                )}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className='min-h-24'
              />
            </div>

            {schema && schema.tables.length > 0 && (
              <div className='text-xs text-muted-foreground p-2 bg-muted rounded max-h-32 overflow-y-auto'>
                <strong>{t('Available tables')}:</strong>
                <div className='mt-1 space-y-1'>
                  {schema.tables.map((table) => (
                    <div key={table.name}>
                      <strong>{table.name}</strong>: {table.columns.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={generating}
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !schema || schema.tables.length === 0}
              >
                {generating ? t('Generating…') : t('Generate')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t('Generated Query')}</label>
              <div className='p-3 bg-muted rounded font-mono text-sm overflow-x-auto'>
                {result.query}
              </div>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t('Explanation')}</label>
              <p className='text-sm text-muted-foreground'>{result.explanation}</p>
            </div>

            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => {
                  setResult(null)
                  setPrompt('')
                }}
              >
                {t('Back')}
              </Button>
              <Button onClick={handleAccept}>{t('Accept & Insert')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
