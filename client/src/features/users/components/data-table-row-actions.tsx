import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPen, UserCheck, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { usersApi } from '@/lib/users-api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

type DataTableRowActionsProps = {
  row: Row<User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { setOpen, setCurrentRow } = useUsers()
  const user = row.original

  const handleStatusChange = async (status: 'active' | 'inactive') => {
    try {
      await usersApi.update(user.id, { status })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t(status === 'active' ? 'User activated' : 'User deactivated'))
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>{t('Open menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(user)
            setOpen('edit')
          }}
        >
          {t('Edit')}
          <DropdownMenuShortcut>
            <UserPen size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {user.status === 'active' ? (
          <DropdownMenuItem onClick={() => handleStatusChange('inactive')}>
            {t('Deactivate')}
            <DropdownMenuShortcut>
              <UserX size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => handleStatusChange('active')}>
            {t('Activate')}
            <DropdownMenuShortcut>
              <UserCheck size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(user)
            setOpen('delete')
          }}
          className='text-red-500!'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
