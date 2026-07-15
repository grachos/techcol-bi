import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  biApi,
  CONNECTOR_TYPE_LABELS,
  type Connector,
  type ConnectorType,
} from '@/lib/bi-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

type FormState = {
  name: string
  type: ConnectorType
  // rest_api
  url: string
  method: string
  headers: string
  dataPath: string
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
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'rest_api',
  url: '',
  method: 'GET',
  headers: '',
  dataPath: '',
  spreadsheetId: '',
  range: '',
  serviceAccountKey: '',
  host: '',
  port: '',
  user: '',
  password: '',
  database: '',
  query: '',
}

function buildConfig(form: FormState): Record<string, unknown> {
  switch (form.type) {
    case 'rest_api': {
      let headers: Record<string, string> | undefined
      if (form.headers.trim()) {
        headers = JSON.parse(form.headers)
      }
      return {
        url: form.url,
        method: form.method,
        ...(headers ? { headers } : {}),
        ...(form.dataPath ? { dataPath: form.dataPath } : {}),
      }
    }
    case 'google_sheets':
      return {
        spreadsheetId: form.spreadsheetId,
        ...(form.range ? { range: form.range } : {}),
        serviceAccountKey: form.serviceAccountKey,
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
  }
}

export function Connectors() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US'
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const set = (field: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

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
                    <Label htmlFor='query'>{t('Query (SELECT only)')}</Label>
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
    </>
  )
}
