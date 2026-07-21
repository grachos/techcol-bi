import { UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useUsers()
  return (
    <Button className='space-x-1' onClick={() => setOpen('add')}>
      <span>{t('Add User')}</span> <UserPlus size={18} />
    </Button>
  )
}
