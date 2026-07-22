import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { aiApi, type WidgetSuggestion } from '@/lib/ai-api'
import { getCalculatedMeasuresForConnector } from '@/lib/semantic-layer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AiWidgetPromptProps {
  disabled?: boolean
  connectors?: Array<{ id: number; name: string }>
  onSuggestion: (suggestion: WidgetSuggestion) => void
}

export function AiWidgetPrompt({ disabled, connectors, onSuggestion }: AiWidgetPromptProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const calculatedMeasures = (connectors ?? []).flatMap((c) => {
        try {
          const measures = getCalculatedMeasuresForConnector(c.id)
          return measures.map((meas) => ({
            name: String(meas.name ?? ''),
            label: String(meas.label ?? meas.name ?? ''),
            expression: String(meas.expression ?? ''),
            connectorId: Number(c.id),
            connectorName: String(c.name ?? ''),
          }))
        } catch {
          return []
        }
      })

      const suggestion = await aiApi.suggestWidget(prompt, calculatedMeasures)
      onSuggestion(suggestion)
      setPrompt('')
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
    <Card className='border-primary/20 bg-primary/5'>
      <CardContent className='flex items-center gap-2 py-3'>
        <Sparkles className='size-5 shrink-0 text-primary' />
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={t(
            'Describe the widget you want, e.g. "sales by month as a line chart"'
          )}
          className='border-none bg-transparent shadow-none focus-visible:ring-0'
        />
        <Button
          size='sm'
          onClick={handleGenerate}
          disabled={disabled || loading || !prompt.trim()}
        >
          {loading ? t('Generating…') : t('Generate with AI')}
        </Button>
      </CardContent>
    </Card>
  )
}
