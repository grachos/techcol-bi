'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { usersApi } from '@/lib/users-api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = async () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(t('Please type "{{word}}" to confirm.', { word: CONFIRM_WORD }))
      return
    }

    const users = selectedRows.map((row) => row.original as User)
    try {
      await Promise.all(users.map((u) => usersApi.remove(u.id)))
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setValue('')
      table.resetRowSelection()
      onOpenChange(false)
      toast.success(t('Deleted {{n}} user(s)', { n: users.length }))
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          {t('Delete {{n}} user(s)', { n: selectedRows.length })}
        </span>
      }
      desc={
        <form
          id='users-multi-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            {t('Are you sure you want to delete the selected users?')} <br />
            {t('This action cannot be undone.')}
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>
              {t('Confirm by typing "{{word}}":', { word: CONFIRM_WORD })}
            </span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('Type "{{word}}" to confirm.', { word: CONFIRM_WORD })}
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>{t('Warning!')}</AlertTitle>
            <AlertDescription>
              {t('Please be careful, this operation can not be rolled back.')}
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText={t('Delete')}
      destructive
    />
  )
}
