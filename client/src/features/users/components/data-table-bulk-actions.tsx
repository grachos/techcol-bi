import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: status === 'active' ? t('Activating users...') : t('Deactivating users...'),
      success: () => {
        table.resetRowSelection()
        return t(status === 'active' ? '{{n}} user(s) activated' : '{{n}} user(s) deactivated', {
          n: selectedUsers.length,
        })
      },
      error: status === 'active' ? t('Error activating users') : t('Error deactivating users'),
    })
    table.resetRowSelection()
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
