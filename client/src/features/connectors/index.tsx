import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import {
  biApi,
  CONNECTOR_TYPE_LABELS,
  type Connector,
  type ConnectorType,
} from '@/lib/bi-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AiGenerateSqlDialog } from './ai-generate-sql-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EditConnectorDialog } from './edit-connector-dialog'
import { PreviewQueryDialog } from './preview-query-dialog'

type FormState = {
  name: string
  type: ConnectorType
  // rest_api
  url: string
  method: string
  headers: string
  dataPath: string
  // rest_api - autenticación encadenada
  authUrl: string
  authMethod: string
  authBody: string
  authBodyType: string
  authHeaders: string
  authTokenPath: string
  tokenHeaderKey: string
  tokenHeaderPrefix: string
  // google_sheets
  spreadsheetId: string
  range: string
  serviceAccountKey: string
  // mysql / postgresql
  host: string
  port: string
  user: string
  password: string
  database: string
  query: string
  // csv
  csvData: string
  csvFileName: string
  // excel (manual)
  excelData: string
  excelFileName: string
  // excel y excel_cloud - múltiples hojas
  excelSheets: string
  excelRelationships: string
  // excel_cloud
  excelUrl: string
  excelFileId: string
  excelProvider: string
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'rest_api',
  url: '',
  method: 'GET',
  headers: '',
  dataPath: '',
  authUrl: '',
  authMethod: 'POST',
  authBody: '',
  authBodyType: 'json',
  authHeaders: '',
  authTokenPath: '',
  tokenHeaderKey: 'Authorization',
  tokenHeaderPrefix: 'Bearer ',
  spreadsheetId: '',
  range: '',
  serviceAccountKey: '',
  host: '',
  port: '',
  user: '',
  password: '',
  database: '',
  query: '',
  csvData: '',
  csvFileName: '',
  excelData: '',
  excelFileName: '',
  excelSheets: '',
  excelRelationships: '',
  excelUrl: '',
  excelFileId: '',
  excelProvider: 'google_drive',
}

function buildConfig(form: FormState): Record<string, unknown> {
  switch (form.type) {
    case 'rest_api': {
      let headers: Record<string, string> | undefined
      if (form.headers.trim()) {
        headers = JSON.parse(form.headers)
      }
      let authHeaders: Record<string, string> | undefined
      if (form.authHeaders.trim()) {
        authHeaders = JSON.parse(form.authHeaders)
      }
      let authBody: Record<string, any> | undefined
      if (form.authBody.trim()) {
        authBody = JSON.parse(form.authBody)
      }
      return {
        url: form.url,
        method: form.method,
        ...(headers ? { headers } : {}),
        ...(form.dataPath ? { dataPath: form.dataPath } : {}),
        // Autenticación encadenada
        ...(form.authUrl ? { authUrl: form.authUrl } : {}),
        ...(form.authUrl ? { authMethod: form.authMethod } : {}),
        ...(authBody ? { authBody, authBodyType: form.authBodyType } : {}),
        ...(authHeaders ? { authHeaders } : {}),
        ...(form.authTokenPath ? { authTokenPath: form.authTokenPath } : {}),
        ...(form.tokenHeaderKey ? { tokenHeaderKey: form.tokenHeaderKey } : {}),
        // Se manda siempre (aunque este vacio): hay APIs que esperan el token
        // crudo, sin prefijo. Omitirlo aqui haria que el servidor aplicara su
        // default "Bearer " y no habria forma de configurar "sin prefijo".
        ...(form.authUrl ? { tokenHeaderPrefix: form.tokenHeaderPrefix } : {}),
      }
    }
    case 'google_sheets': {
      let sheets: string[] | undefined
      if (form.excelSheets.trim()) {
        sheets = form.excelSheets.split(',').map(s => s.trim()).filter(Boolean)
      }
      let relationships: any[] | undefined
      if (form.excelRelationships.trim()) {
        relationships = JSON.parse(form.excelRelationships)
      }
      return {
        spreadsheetId: form.spreadsheetId,
        ...(form.range ? { range: form.range } : {}),
        serviceAccountKey: form.serviceAccountKey,
        ...(sheets ? { sheets } : {}),
        ...(relationships ? { relationships } : {}),
      }
    }
    case 'mysql':
    case 'postgresql':
      return {
        host: form.host,
        ...(form.port ? { port: Number(form.port) } : {}),
        user: form.user,
        password: form.password,
        database: form.database,
        query: form.query,
      }
    case 'csv':
      return {
        csvData: form.csvData,
      }
    case 'excel': {
      let sheets: string[] | undefined
      if (form.excelSheets.trim()) {
        sheets = form.excelSheets.split(',').map(s => s.trim()).filter(Boolean)
      }
      let relationships: any[] | undefined
      if (form.excelRelationships.trim()) {
        relationships = JSON.parse(form.excelRelationships)
      }
      return {
        fileData: form.excelData,
        ...(sheets ? { sheets } : {}),
        ...(relationships ? { relationships } : {}),
      }
    }
    case 'excel_cloud': {
      let sheets: string[] | undefined
      if (form.excelSheets.trim()) {
        sheets = form.excelSheets.split(',').map(s => s.trim()).filter(Boolean)
      }
      let relationships: any[] | undefined
      if (form.excelRelationships.trim()) {
        relationships = JSON.parse(form.excelRelationships)
      }
      return {
        ...(form.excelUrl ? { url: form.excelUrl } : {}),
        ...(form.excelFileId ? { fileId: form.excelFileId } : {}),
        provider: form.excelProvider,
        ...(sheets ? { sheets } : {}),
        ...(relationships ? { relationships } : {}),
      }
    }
  }
}

export function Connectors() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US'
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<(Connector & { config: Record<string, unknown> }) | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

  const set = (field: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const base64 = btoa(unescape(encodeURIComponent(content)))
      setForm((f) => ({
        ...f,
        csvData: base64,
        csvFileName: file.name,
      }))
      toast.success(t('CSV loaded: {{fileName}}', { fileName: file.name }))
    }
    reader.onerror = () => {
      toast.error(t('Error reading CSV file'))
    }
    reader.readAsText(file)
  }

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)))
      setForm((f) => ({
        ...f,
        excelData: base64,
        excelFileName: file.name,
      }))
      toast.success(t('Excel loaded: {{fileName}}', { fileName: file.name }))
    }
    reader.onerror = () => {
      toast.error(t('Error reading Excel file'))
    }
    reader.readAsArrayBuffer(file)
  }

  const load = useCallback(async () => {
    try {
      setConnectors(await biApi.list())
    } catch (error) {
      toast.error(t('Could not load connectors: {{error}}', { error: String(error) }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.warning(t('Give the connector a name'))
      return
    }
    if (form.type === 'csv' && !form.csvData) {
      toast.warning(t('Upload a CSV file'))
      return
    }
    if (form.type === 'excel' && !form.excelData) {
      toast.warning(t('Upload an Excel file'))
      return
    }
    if (form.type === 'excel_cloud' && !form.excelFileId && !form.excelUrl) {
      toast.warning(t('Provide a file ID or URL'))
      return
    }
    setSaving(true)
    try {
      const config = buildConfig(form)
      await biApi.create({ name: form.name, type: form.type, config })
      toast.success(t('Connector "{{name}}" created', { name: form.name }))
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (c: Connector) => {
    setBusyId(c.id)
    try {
      const { ok } = await biApi.test(c.id)
      if (ok) toast.success(t('"{{name}}" connects successfully', { name: c.name }))
      else toast.error(t('"{{name}}" could not connect', { name: c.name }))
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (c: Connector) => {
    setBusyId(c.id)
    try {
      await biApi.remove(c.id)
      toast.success(t('Connector "{{name}}" deleted', { name: c.name }))
      await load()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setBusyId(null)
    }
  }

  const handleEdit = async (c: Connector) => {
    try {
      const connectorData = await biApi.get(c.id)
      setEditingConnector(connectorData)
      setEditDialogOpen(true)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>{t('Connectors')}</h2>
          <p className='text-muted-foreground'>
            {t(
              'Connect your data sources: APIs, Google Sheets and databases. Credentials are encrypted on the server.'
            )}
          </p>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Formulario de creacion */}
          <Card>
            <CardHeader>
              <CardTitle>{t('New connector')}</CardTitle>
              <CardDescription>
                {t('The form changes based on the source type.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='name'>{t('Name')}</Label>
                  <Input
                    id='name'
                    placeholder='Ventas Shopify'
                    value={form.name}
                    onChange={(e) => set('name')(e.target.value)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Type')}</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => set('type')(v as ConnectorType)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(CONNECTOR_TYPE_LABELS) as ConnectorType[]
                      ).map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONNECTOR_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.type === 'rest_api' && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='url'>URL</Label>
                    <Input
                      id='url'
                      placeholder='https://api.ejemplo.com/ventas'
                      value={form.url}
                      onChange={(e) => set('url')(e.target.value)}
                    />
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label>{t('Method')}</Label>
                      <Select
                        value={form.method}
                        onValueChange={set('method')}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='GET'>GET</SelectItem>
                          <SelectItem value='POST'>POST</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='dataPath'>
                        {t('Data path')}{' '}
                        <span className='text-muted-foreground'>
                          {t('(optional)')}
                        </span>
                      </Label>
                      <Input
                        id='dataPath'
                        placeholder='data.items'
                        value={form.dataPath}
                        onChange={(e) => set('dataPath')(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='headers'>
                      {t('Headers JSON')}{' '}
                      <span className='text-muted-foreground'>
                        {t('(optional)')}
                      </span>
                    </Label>
                    <Textarea
                      id='headers'
                      placeholder='{"Authorization": "Bearer TU_TOKEN"}'
                      value={form.headers}
                      onChange={(e) => set('headers')(e.target.value)}
                    />
                  </div>

                  {/* Autenticación encadenada */}
                  <div className='border-t pt-4 mt-4 space-y-4'>
                    <Label className='text-sm font-semibold block'>
                      {t('Chained authentication')} {t('(optional)')}
                    </Label>
                    <div className='space-y-2'>
                      <Label htmlFor='authUrl'>
                        {t('Authentication URL')}
                      </Label>
                      <Input
                        id='authUrl'
                        placeholder='https://auth.ejemplo.com/token'
                        value={form.authUrl}
                        onChange={(e) => set('authUrl')(e.target.value)}
                      />
                    </div>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label>{t('Authentication method')}</Label>
                        <Select
                          value={form.authMethod}
                          onValueChange={set('authMethod')}
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='GET'>GET</SelectItem>
                            <SelectItem value='POST'>POST</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='authTokenPath'>
                          {t('Token path in response')}
                        </Label>
                        <Input
                          id='authTokenPath'
                          placeholder='access_token'
                          value={form.authTokenPath}
                          onChange={(e) => set('authTokenPath')(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='authBody'>
                        {t('Authentication body')}{' '}
                        <span className='text-muted-foreground'>
                          {t('(optional)')}
                        </span>
                      </Label>
                      <Textarea
                        id='authBody'
                        placeholder='{"usuario_login": "usuario", "usuario_password": "contraseña"}'
                        value={form.authBody}
                        onChange={(e) => set('authBody')(e.target.value)}
                        className='min-h-16 font-mono text-sm'
                      />
                      <p className='text-xs text-muted-foreground'>
                        {t('Write the fields as JSON; the format below decides how they are sent.')}
                      </p>
                    </div>
                    <div className='space-y-2'>
                      <Label>{t('Body format')}</Label>
                      <Select
                        value={form.authBodyType}
                        onValueChange={set('authBodyType')}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='json'>
                            JSON (application/json)
                          </SelectItem>
                          <SelectItem value='form'>
                            Form (x-www-form-urlencoded)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='authHeaders'>
                        {t('Authentication headers (JSON)')}{' '}
                        <span className='text-muted-foreground'>
                          {t('(optional)')}
                        </span>
                      </Label>
                      <Textarea
                        id='authHeaders'
                        placeholder='{"Content-Type": "application/json"}'
                        value={form.authHeaders}
                        onChange={(e) => set('authHeaders')(e.target.value)}
                        className='min-h-16'
                      />
                    </div>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label htmlFor='tokenHeaderKey'>
                          {t('Header key for token')}
                        </Label>
                        <Input
                          id='tokenHeaderKey'
                          placeholder='Authorization'
                          value={form.tokenHeaderKey}
                          onChange={(e) => set('tokenHeaderKey')(e.target.value)}
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='tokenHeaderPrefix'>
                          {t('Token prefix')}
                        </Label>
                        <Input
                          id='tokenHeaderPrefix'
                          placeholder='Bearer '
                          value={form.tokenHeaderPrefix}
                          onChange={(e) => set('tokenHeaderPrefix')(e.target.value)}
                        />
                        <p className='text-xs text-muted-foreground'>
                          {t('Leave empty if the API expects the raw token.')}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {form.type === 'google_sheets' && (
                <>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='spreadsheetId'>Spreadsheet ID</Label>
                      <Input
                        id='spreadsheetId'
                        placeholder='1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
                        value={form.spreadsheetId}
                        onChange={(e) => set('spreadsheetId')(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='range'>
                        {t('Range')}{' '}
                        <span className='text-muted-foreground'>
                          {t('(optional)')}
                        </span>
                      </Label>
                      <Input
                        id='range'
                        placeholder='Hoja1!A1:F100'
                        value={form.range}
                        onChange={(e) => set('range')(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='serviceAccountKey'>
                      {t('Service Account Key (JSON)')}
                    </Label>
                    <Textarea
                      id='serviceAccountKey'
                      className='min-h-28 font-mono text-xs'
                      placeholder='{"type": "service_account", ...}'
                      value={form.serviceAccountKey}
                      onChange={(e) =>
                        set('serviceAccountKey')(e.target.value)
                      }
                    />
                  </div>

                  {/* Múltiples hojas y relaciones */}
                  <div className='border-t pt-4 mt-4'>
                    <Label className='text-sm font-semibold mb-3 block'>
                      Múltiples hojas y relaciones (opcional)
                    </Label>
                    <div className='space-y-2'>
                      <Label htmlFor='gsSheets'>Nombres de hojas</Label>
                      <Input
                        id='gsSheets'
                        placeholder='Usuarios, Pedidos'
                        value={form.excelSheets}
                        onChange={(e) => set('excelSheets')(e.target.value)}
                      />
                      <p className='text-xs text-muted-foreground'>Separar por comas para múltiples hojas</p>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='gsRelationships'>Relationships JSON (opcional)</Label>
                      <Textarea
                        id='gsRelationships'
                        placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                        value={form.excelRelationships}
                        onChange={(e) => set('excelRelationships')(e.target.value)}
                        className='min-h-24 font-mono text-sm'
                      />
                    </div>
                  </div>
                </>
              )}

              {(form.type === 'mysql' || form.type === 'postgresql') && (
                <>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='host'>{t('Host')}</Label>
                      <Input
                        id='host'
                        placeholder='localhost'
                        value={form.host}
                        onChange={(e) => set('host')(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='port'>{t('Port')}</Label>
                      <Input
                        id='port'
                        placeholder={form.type === 'mysql' ? '3306' : '5432'}
                        value={form.port}
                        onChange={(e) => set('port')(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='user'>{t('User')}</Label>
                      <Input
                        id='user'
                        value={form.user}
                        onChange={(e) => set('user')(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='password'>{t('Password')}</Label>
                      <Input
                        id='password'
                        type='password'
                        value={form.password}
                        onChange={(e) => set('password')(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='database'>{t('Database')}</Label>
                    <Input
                      id='database'
                      value={form.database}
                      onChange={(e) => set('database')(e.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label htmlFor='query'>{t('Query (SELECT only)')}</Label>
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => setPreviewDialogOpen(true)}
                          disabled={!form.query.trim()}
                          className='gap-1 h-8 text-xs'
                        >
                          {t('Preview')}
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => setSqlDialogOpen(true)}
                          className='gap-1 h-8 text-xs'
                        >
                          <Sparkles className='size-3.5' />
                          {t('Generate with AI')}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id='query'
                      className='font-mono text-xs'
                      placeholder='SELECT mes, total FROM ventas ORDER BY mes'
                      value={form.query}
                      onChange={(e) => set('query')(e.target.value)}
                    />
                  </div>
                </>
              )}

              {form.type === 'csv' && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='csvFile'>{t('CSV File')}</Label>
                    <Input
                      id='csvFile'
                      type='file'
                      accept='.csv'
                      onChange={handleCSVUpload}
                    />
                  </div>
                  {form.csvFileName && (
                    <div className='p-3 bg-muted rounded text-sm'>
                      <p className='text-muted-foreground'>
                        {t('File loaded: {{fileName}}', { fileName: form.csvFileName })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {form.type === 'excel' && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='excelFile'>Excel File</Label>
                    <Input
                      id='excelFile'
                      type='file'
                      accept='.xlsx,.xls'
                      onChange={handleExcelUpload}
                    />
                  </div>
                  {form.excelFileName && (
                    <div className='p-3 bg-muted rounded text-sm'>
                      <p className='text-muted-foreground'>
                        {t('File loaded: {{fileName}}', { fileName: form.excelFileName })}
                      </p>
                    </div>
                  )}
                  <div className='space-y-2'>
                    <Label htmlFor='excelSheets'>Sheet Names (opcional)</Label>
                    <Input
                      id='excelSheets'
                      placeholder='Usuarios, Pedidos'
                      value={form.excelSheets}
                      onChange={(e) => set('excelSheets')(e.target.value)}
                    />
                    <p className='text-xs text-muted-foreground'>Separar por comas para múltiples hojas</p>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='excelRelationships'>Relationships JSON (opcional)</Label>
                    <Textarea
                      id='excelRelationships'
                      placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                      value={form.excelRelationships}
                      onChange={(e) => set('excelRelationships')(e.target.value)}
                      className='min-h-24 font-mono text-sm'
                    />
                  </div>
                </>
              )}

              {form.type === 'excel_cloud' && (
                <>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='excelProvider'>Provider</Label>
                      <Select value={form.excelProvider} onValueChange={set('excelProvider')}>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='google_drive'>Google Drive</SelectItem>
                          <SelectItem value='onedrive'>OneDrive</SelectItem>
                          <SelectItem value='dropbox'>Dropbox</SelectItem>
                          <SelectItem value='direct_url'>Direct URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='excelFileId'>File ID o URL</Label>
                      <Input
                        id='excelFileId'
                        placeholder='1A2B3C4D5E... o https://...'
                        value={form.excelFileId || form.excelUrl}
                        onChange={(e) => {
                          if (form.excelProvider === 'direct_url') {
                            set('excelUrl')(e.target.value)
                          } else {
                            set('excelFileId')(e.target.value)
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='excelSheetsCloud'>Sheet Names (opcional)</Label>
                    <Input
                      id='excelSheetsCloud'
                      placeholder='Usuarios, Pedidos'
                      value={form.excelSheets}
                      onChange={(e) => set('excelSheets')(e.target.value)}
                    />
                    <p className='text-xs text-muted-foreground'>Separar por comas para múltiples hojas</p>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='excelRelationshipsCloud'>Relationships JSON (opcional)</Label>
                    <Textarea
                      id='excelRelationshipsCloud'
                      placeholder='[{"from": "Usuarios:ID", "to": "Pedidos:UsuarioID", "name": "pedidos"}]'
                      value={form.excelRelationships}
                      onChange={(e) => set('excelRelationships')(e.target.value)}
                      className='min-h-24 font-mono text-sm'
                    />
                  </div>
                </>
              )}

              <Button
                className='w-full'
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? t('Saving…') : t('Create connector')}
              </Button>
            </CardContent>
          </Card>

          {/* Lista de conectores */}
          <div className='space-y-4'>
            {connectors.length === 0 && (
              <Card>
                <CardContent className='text-muted-foreground py-10 text-center text-sm'>
                  {t(
                    "You don't have connectors yet. Create the first one with the form."
                  )}
                </CardContent>
              </Card>
            )}
            {connectors.map((c) => (
              <Card key={c.id}>
                <CardContent className='flex flex-wrap items-center justify-between gap-3 py-4'>
                  <div>
                    <div className='flex items-center gap-2 font-medium'>
                      {c.name}
                      <Badge variant='outline'>
                        {CONNECTOR_TYPE_LABELS[c.type]}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {t('Created: {{date}}', {
                        date: new Date(c.created_at).toLocaleString(locale),
                      })}
                    </p>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={busyId === c.id}
                      onClick={() => handleEdit(c)}
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={busyId === c.id}
                      onClick={() => handleTest(c)}
                    >
                      {t('Test')}
                    </Button>
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={busyId === c.id}
                      onClick={() => handleDelete(c)}
                    >
                      {t('Delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Main>

      <AiGenerateSqlDialog
        open={sqlDialogOpen}
        onOpenChange={setSqlDialogOpen}
        connectorType={
          form.type === 'mysql' || form.type === 'postgresql'
            ? form.type
            : 'mysql'
        }
        host={form.host}
        port={form.port}
        user={form.user}
        password={form.password}
        database={form.database}
        onQuery={(query) => set('query')(query)}
      />

      <EditConnectorDialog
        connector={editingConnector}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={load}
      />

      <PreviewQueryDialog
        connectorId={editingConnector?.id ?? null}
        query={form.query}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        connectorType={(form.type === 'mysql' || form.type === 'postgresql' ? form.type : 'mysql') as 'mysql' | 'postgresql'}
        onQueryChange={(newQuery) => set('query')(newQuery)}
      />
    </>
  )
}
