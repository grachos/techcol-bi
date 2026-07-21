import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
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
import { users as initialUsers } from './data/users'
import { type User } from './data/schema'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [users, setUsers] = useState<User[]>(initialUsers)

  const updateUserStatus = (userId: string, status: 'active' | 'inactive') => {
    setUsers(users.map(u => u.id === userId ? { ...u, status } : u))
  }

  const deleteUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId))
  }

  const updateUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers)
  }

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

        <UsersTable
          data={users}
          search={search}
          navigate={navigate}
          onUpdateUserStatus={updateUserStatus}
          onDeleteUser={deleteUser}
          onUpdateUsers={updateUsers}
        />
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
