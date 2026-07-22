import { useTranslation } from 'react-i18next'
import { getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { usersApi } from '@/lib/users-api'
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  return (
    <UsersProvider>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>{t('User List')}</h2>
            <p className='text-muted-foreground'>
              {t('Manage users and assign roles and access permissions.')}
            </p>
          </div>
          <UsersPrimaryButtons />
        </div>

        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>{t('Administrator Only')}</AlertTitle>
          <AlertDescription>
            {t(
              'Only administrators can manage users in this module. Users with custom roles can access only the dashboards and pages assigned to them.'
            )}
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
        ) : (
          <UsersTable data={users} search={search} navigate={navigate} />
        )}
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
