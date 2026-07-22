'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '@/lib/users-api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')

  const handleDelete = async () => {
    if (value.trim() !== currentRow.email) return
    try {
      await usersApi.remove(currentRow.id)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('User deleted'))
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-delete-form'
      disabled={value.trim() !== currentRow.email}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='stroke-destructive me-1 inline-block'
            size={18}
          />{' '}
          {t('Delete User')}
        </span>
      }
      desc={
        <form
          id='users-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            {t('Are you sure you want to delete')}{' '}
            <span className='font-bold'>{currentRow.email}</span>?
            <br />
            {t('This action will permanently remove the user with the role of')}{' '}
            <span className='font-bold'>{currentRow.role.toUpperCase()}</span>{' '}
            {t('from the system. This cannot be undone.')}
          </p>

          <Label className='my-2'>
            {t('Email:')}
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('Enter email to confirm deletion.')}
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
