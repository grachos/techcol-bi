import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
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

interface AiGenerateSqlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorType: 'mysql' | 'postgresql'
  sampleColumns: string[]
  onQuery: (query: string) => void
}

export function AiGenerateSqlDialog({
  open,
  onOpenChange,
  connectorType,
  sampleColumns,
  onQuery,
}: AiGenerateSqlDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ query: string; explanation: string } | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.warning(t('Describe what data you want'))
      return
    }
    setGenerating(true)
    try {
      const res = await aiApi.generateSql(prompt, sampleColumns, connectorType)
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

        {!result ? (
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

            {sampleColumns.length > 0 && (
              <div className='text-xs text-muted-foreground p-2 bg-muted rounded'>
                <strong>{t('Available columns')}:</strong> {sampleColumns.join(', ')}
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
              <Button onClick={handleGenerate} disabled={generating}>
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
