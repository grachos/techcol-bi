import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { aiApi, type WidgetEditSuggestion } from '@/lib/ai-api'
import { type Widget } from '@/lib/dashboard-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface AiEditWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: number
  widget: Widget
  onSuggestion: (suggestion: WidgetEditSuggestion) => void
}

export function AiEditWidgetDialog({
  open,
  onOpenChange,
  dashboardId,
  widget,
  onSuggestion,
}: AiEditWidgetDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const suggestion = await aiApi.editWidget(dashboardId, widget.id, prompt)
      onSuggestion(suggestion)
      setPrompt('')
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='size-4 text-primary' />
            {t('Edit "{{title}}" with AI', { title: widget.title })}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={t(
            'Describe what to change, e.g. "switch to a pie chart"'
          )}
          autoFocus
        />
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? t('Generating…') : t('Generate with AI')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
