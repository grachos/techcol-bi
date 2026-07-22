import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, UserX, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { usersApi } from '@/lib/users-api'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
    const users = selectedRows.map((row) => row.original as User)
    try {
      await Promise.all(users.map((u) => usersApi.update(u.id, { status })))
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(
        t(status === 'active' ? '{{n}} user(s) activated' : '{{n}} user(s) deactivated', {
          n: users.length,
        })
      )
      table.resetRowSelection()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('active')}
              className='size-8'
              aria-label={t('Activate selected users')}
              title={t('Activate selected users')}
            >
              <UserCheck />
              <span className='sr-only'>{t('Activate selected users')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Activate selected users')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('inactive')}
              className='size-8'
              aria-label={t('Deactivate selected users')}
              title={t('Deactivate selected users')}
            >
              <UserX />
              <span className='sr-only'>{t('Deactivate selected users')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Deactivate selected users')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label={t('Delete selected users')}
              title={t('Delete selected users')}
            >
              <Trash2 />
              <span className='sr-only'>{t('Delete selected users')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Delete selected users')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
