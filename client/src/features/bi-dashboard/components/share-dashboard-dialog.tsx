import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { biApi } from '@/lib/bi-api'

interface ShareDashboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: number
  dashboardName: string
}

export function ShareDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  dashboardName,
}: ShareDashboardDialogProps) {
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    setLoading(true)
    try {
      const result = await biApi.dashboard.share(dashboardId)
      setShareToken(result.shareToken)
    } catch (error) {
      console.error('Error sharing dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = shareToken
    ? `${window.location.origin}/share/${shareToken}`
    : ''

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Compartir Dashboard</DialogTitle>
          <DialogDescription>
            Crea un link público para que otros vean "{dashboardName}" en modo
            de solo lectura
          </DialogDescription>
        </DialogHeader>

        {!shareToken ? (
          <div className='flex gap-2'>
            <Button
              onClick={handleShare}
              disabled={loading}
              className='flex-1'
            >
              {loading ? 'Generando...' : 'Generar Link de Compartir'}
            </Button>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Link público</label>
              <div className='flex gap-2'>
                <Input
                  value={shareUrl}
                  readOnly
                  className='text-xs'
                />
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleCopyLink}
                  className='px-2'
                >
                  {copied ? (
                    <Check className='h-4 w-4 text-green-600' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            <div className='rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-400'>
              <p className='font-semibold mb-1'>Permisos en vista compartida:</p>
              <ul className='space-y-1 text-xs list-disc list-inside'>
                <li>✓ Ver widgets y datos</li>
                <li>✓ Usar filtros interactivos</li>
                <li>✗ Agregar/eliminar widgets</li>
                <li>✗ Modificar configuración</li>
                <li>✗ Descargar datos</li>
              </ul>
            </div>

            <Button
              onClick={() => {
                setShareToken(null)
                onOpenChange(false)
              }}
              variant='outline'
              className='w-full'
            >
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
