import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { biApi, SECRET_MASK, type Connector } from '@/lib/bi-api'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EditConnectorDialogProps {
  connector: Connector & { config: Record<string, unknown> } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditConnectorDialog({
  connector,
  open,
  onOpenChange,
  onSaved,
}: EditConnectorDialogProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(connector?.name ?? '')
  const [config, setConfig] = useState(connector?.config ?? {})

  // Sincronizar estados cuando el connector cambia
  useEffect(() => {
    if (connector) {
      setName(connector.name)
      setConfig(connector.config ?? {})
    }
  }, [connector])

  const handleSave = async () => {
    if (!connector || !name.trim()) {
      toast.warning(t('Give the connector a name'))
      return
    }

    setSaving(true)
    try {
      await biApi.update(connector.id, { name, config })
      toast.success(t('Connector "{{name}}" updated', { name }))
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  if (!connector) return null

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  // Un secreto guardado llega enmascarado: se muestra vacio con una pista y,
  // si el usuario no lo toca, se reenvia la marca para conservarlo.
  const isMasked = (key: string) => config[key] === SECRET_MASK
  const secretText = (key: string) => {
    const v = config[key]
    if (v === SECRET_MASK) return ''
    return typeof v === 'string' ? v : JSON.stringify(v ?? {}, null, 2)
  }
  const secretHint = (fallback: string) =>
    t('•••• saved — type to replace') || fallback

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Edit Connector')}</DialogTitle>
          <DialogDescription>
            {t('Update connector details and configuration')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t('Name')}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Connector"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('Type')}</Label>
            <div className="p-3 bg-muted rounded text-sm">{connector.type}</div>
          </div>

          {/* Config fields por tipo de conector */}
          {connector.type === 'rest_api' && (
            <>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={(config.url as string) ?? ''}
                  onChange={(e) => handleConfigChange('url', e.target.value)}
                  placeholder="https://api.example.com/data"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Method')}</Label>
                <Select
                  value={(config.method as string) ?? 'GET'}
                  onValueChange={(v) => handleConfigChange('method', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('Data path')} (opcional)</Label>
                <Input
                  value={(config.dataPath as string) ?? ''}
                  onChange={(e) => handleConfigChange('dataPath', e.target.value)}
                  placeholder="data.items"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Query parameters')} (opcional)</Label>
                <Textarea
                  value={
                    typeof config.queryParams === 'string'
                      ? config.queryParams
                      : JSON.stringify(config.queryParams ?? {}, null, 2)
                  }
                  onChange={(e) => {
                    try {
                      handleConfigChange('queryParams', JSON.parse(e.target.value))
                    } catch {
                      handleConfigChange('queryParams', e.target.value)
                    }
                  }}
                  placeholder={'{"fecha_inicio": "{{from}}", "fecha_fin": "{{to}}"}'}
                  className="min-h-20 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Sent to the API as ?key=value. A value can be fixed, or take the dashboard date filter using the placeholders shown in the example. Params without a value are left out of the URL.')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Headers JSON (opcional)</Label>
                <Textarea
                  value={secretText('headers')}
                  onChange={(e) => {
                    try {
                      handleConfigChange('headers', JSON.parse(e.target.value))
                    } catch {
                      handleConfigChange('headers', e.target.value)
                    }
                  }}
                  placeholder={
                    isMasked('headers')
                      ? secretHint('•••• guardado')
                      : '{"Authorization": "Bearer TOKEN"}'
                  }
                  className="min-h-24 font-mono text-sm"
                />
              </div>

              {/* Autenticación encadenada */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-semibold mb-3 block">Autenticación encadenada (opcional)</Label>
                <div className="space-y-2">
                  <Label className="text-xs">URL de autenticación</Label>
                  <Input
                    value={(config.authUrl as string) ?? ''}
                    onChange={(e) => handleConfigChange('authUrl', e.target.value)}
                    placeholder="https://auth.example.com/token"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Método de autenticación</Label>
                  <Select
                    value={(config.authMethod as string) ?? 'POST'}
                    onValueChange={(v) => handleConfigChange('authMethod', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Body para autenticación (JSON, opcional)</Label>
                  <Textarea
                    value={secretText('authBody')}
                    onChange={(e) => {
                      try {
                        handleConfigChange('authBody', JSON.parse(e.target.value))
                      } catch {
                        handleConfigChange('authBody', e.target.value)
                      }
                    }}
                    placeholder={
                      isMasked('authBody')
                        ? secretHint('•••• guardado')
                        : '{"username": "user", "password": "pass"}'
                    }
                    className="min-h-16 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Headers de autenticación (JSON, opcional)</Label>
                  <Textarea
                    value={secretText('authHeaders')}
                    onChange={(e) => {
                      try {
                        handleConfigChange('authHeaders', JSON.parse(e.target.value))
                      } catch {
                        handleConfigChange('authHeaders', e.target.value)
                      }
                    }}
                    placeholder={
                      isMasked('authHeaders')
                        ? secretHint('•••• guardado')
                        : '{"Content-Type": "application/json"}'
                    }
                    className="min-h-16 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ruta del token en respuesta</Label>
                  <Input
                    value={(config.authTokenPath as string) ?? ''}
                    onChange={(e) => handleConfigChange('authTokenPath', e.target.value)}
                    placeholder="access_token o data.token"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Header para el token (default: Authorization)</Label>
                  <Input
                    value={(config.tokenHeaderKey as string) ?? 'Authorization'}
                    onChange={(e) => handleConfigChange('tokenHeaderKey', e.target.value)}
                    placeholder="Authorization"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Prefijo del token (default: Bearer )</Label>
                  <Input
                    value={(config.tokenHeaderPrefix as string) ?? 'Bearer '}
                    onChange={(e) => handleConfigChange('tokenHeaderPrefix', e.target.value)}
                    placeholder="Bearer "
                  />
                </div>
              </div>
            </>
          )}

          {(connector.type === 'mysql' || connector.type === 'postgresql') && (
            <>
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={(config.host as string) ?? ''}
                  onChange={(e) => handleConfigChange('host', e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Port')}</Label>
                <Input
                  value={(config.port as string | number) ?? ''}
                  onChange={(e) => handleConfigChange('port', Number(e.target.value) || e.target.value)}
                  placeholder={connector.type === 'mysql' ? '3306' : '5432'}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('User')}</Label>
                <Input
                  value={(config.user as string) ?? ''}
                  onChange={(e) => handleConfigChange('user', e.target.value)}
                  placeholder="root"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Password')} (opcional)</Label>
                <Input
                  type="password"
                  value={isMasked('password') ? '' : ((config.password as string) ?? '')}
                  onChange={(e) => handleConfigChange('password', e.target.value)}
                  placeholder={isMasked('password') ? secretHint('•••• guardado') : '••••••'}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Database')}</Label>
                <Input
                  value={(config.database as string) ?? ''}
                  onChange={(e) => handleConfigChange('database', e.target.value)}
                  placeholder="mydb"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Query')} (SELECT only)</Label>
                <Textarea
                  value={(config.query as string) ?? ''}
                  onChange={(e) => handleConfigChange('query', e.target.value)}
                  placeholder="SELECT * FROM users"
                  className="min-h-24 font-mono text-sm"
                />
              </div>
            </>
          )}

          {connector.type === 'google_sheets' && (
            <>
              <div className="space-y-2">
                <Label>Spreadsheet ID</Label>
                <Input
                  value={(config.spreadsheetId as string) ?? ''}
                  onChange={(e) => handleConfigChange('spreadsheetId', e.target.value)}
                  placeholder="1234...ABC"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Range')} (opcional)</Label>
                <Input
                  value={(config.range as string) ?? ''}
                  onChange={(e) => handleConfigChange('range', e.target.value)}
                  placeholder="Sheet1!A1:Z100"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Account Key (JSON)</Label>
                <Textarea
                  value={secretText('serviceAccountKey')}
                  onChange={(e) => {
                    try {
                      handleConfigChange('serviceAccountKey', JSON.parse(e.target.value))
                    } catch {
                      handleConfigChange('serviceAccountKey', e.target.value)
                    }
                  }}
                  placeholder={
                    isMasked('serviceAccountKey')
                      ? secretHint('•••• guardado')
                      : 'Paste your service account JSON'
                  }
                  className="min-h-32 font-mono text-sm"
                />
              </div>

              {/* Múltiples hojas y relaciones */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-semibold mb-3 block">
                  Múltiples hojas y relaciones (opcional)
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs">Nombres de hojas</Label>
                  <Input
                    value={(config.sheets as any)?.join(', ') ?? ''}
                    onChange={(e) => handleConfigChange('sheets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Usuarios, Pedidos"
                  />
                  <p className="text-xs text-muted-foreground">Separar por comas</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Relationships JSON (opcional)</Label>
                  <Textarea
                    value={JSON.stringify(config.relationships ?? [], null, 2)}
                    onChange={(e) => {
                      try {
                        handleConfigChange('relationships', JSON.parse(e.target.value))
                      } catch {
                        handleConfigChange('relationships', e.target.value)
                      }
                    }}
                    placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                    className="min-h-24 font-mono text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {connector.type === 'csv' && (
            <div className="p-3 bg-muted rounded text-sm text-muted-foreground">
              {t('CSV connectors are read-only. The file is stored as base64 in the database.')}
            </div>
          )}

          {connector.type === 'excel' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Sheet Names (opcional)</Label>
                <Input
                  value={(config.sheets as any)?.join(', ') ?? ''}
                  onChange={(e) => handleConfigChange('sheets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Usuarios, Pedidos"
                />
                <p className="text-xs text-muted-foreground">Separar por comas</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Relationships JSON (opcional)</Label>
                <Textarea
                  value={JSON.stringify(config.relationships ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      handleConfigChange('relationships', JSON.parse(e.target.value))
                    } catch {
                      handleConfigChange('relationships', e.target.value)
                    }
                  }}
                  placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                  className="min-h-24 font-mono text-sm"
                />
              </div>
              <div className="p-3 bg-muted rounded text-sm text-muted-foreground">
                El archivo Excel está almacenado en base64 en la base de datos.
              </div>
            </>
          )}

          {connector.type === 'excel_cloud' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  <Select
                    value={(config.provider as string) ?? 'google_drive'}
                    onValueChange={(v) => handleConfigChange('provider', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_drive">Google Drive</SelectItem>
                      <SelectItem value="onedrive">OneDrive</SelectItem>
                      <SelectItem value="dropbox">Dropbox</SelectItem>
                      <SelectItem value="direct_url">Direct URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">File ID o URL</Label>
                  <Input
                    value={(config.fileId as string) ?? (config.url as string) ?? ''}
                    onChange={(e) => {
                      if (config.provider === 'direct_url') {
                        handleConfigChange('url', e.target.value)
                      } else {
                        handleConfigChange('fileId', e.target.value)
                      }
                    }}
                    placeholder="1A2B3C4D5E... o https://..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sheet Names (opcional)</Label>
                <Input
                  value={(config.sheets as any)?.join(', ') ?? ''}
                  onChange={(e) => handleConfigChange('sheets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Usuarios, Pedidos"
                />
                <p className="text-xs text-muted-foreground">Separar por comas</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Relationships JSON (opcional)</Label>
                <Textarea
                  value={JSON.stringify(config.relationships ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      handleConfigChange('relationships', JSON.parse(e.target.value))
                    } catch {
                      handleConfigChange('relationships', e.target.value)
                    }
                  }}
                  placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                  className="min-h-24 font-mono text-sm"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving…') : t('Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
