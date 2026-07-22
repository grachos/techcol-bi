'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '@/lib/users-api'
import { dashboardApi } from '@/lib/dashboard-api'
import { GRANTABLE_PAGES } from '@/lib/access'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'
import { type User } from '../data/schema'

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z.string().min(1, t('Name is required.')),
    email: z.email({
      error: (iss) => (iss.input === '' ? t('Email is required.') : undefined),
    }),
    role: z.enum(['admin', 'custom']),
    // En creacion la contrasena es opcional (queda pendiente de primer ingreso);
    // en edicion vacio = sin cambio. Si se escribe, minimo 8 caracteres.
    password: z
      .string()
      .refine((p) => p === '' || p.length >= 8, t('Password must be at least 8 characters long.')),
    dashboardIds: z.array(z.number()),
    pageNames: z.array(z.string()),
  })
}

type UserForm = z.infer<ReturnType<typeof buildSchema>>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEdit = !!currentRow
  const [saving, setSaving] = useState(false)

  const { data: dashboards = [], isLoading: loadingDashboards } = useQuery({
    queryKey: ['dashboards', 'all'],
    queryFn: dashboardApi.list,
    enabled: open,
  })

  const form = useForm<UserForm>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      role: 'custom',
      password: '',
      dashboardIds: [],
      pageNames: [],
    },
  })

  // Rellena el formulario al abrir (evita estado obsoleto entre aperturas).
  useEffect(() => {
    if (!open) return
    form.reset(
      isEdit
        ? {
            name: currentRow!.name ?? '',
            email: currentRow!.email,
            role: currentRow!.role,
            password: '',
            dashboardIds: currentRow!.permissions?.dashboardIds ?? [],
            pageNames: currentRow!.permissions?.pageNames ?? [],
          }
        : {
            name: '',
            email: '',
            role: 'custom',
            password: '',
            dashboardIds: [],
            pageNames: [],
          }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedRole = form.watch('role')

  const onSubmit = async (values: UserForm) => {
    setSaving(true)
    try {
      if (isEdit) {
        await usersApi.update(currentRow!.id, {
          name: values.name,
          role: values.role,
          password: values.password || undefined,
          pageNames: values.role === 'custom' ? values.pageNames : [],
          dashboardIds: values.role === 'custom' ? values.dashboardIds : [],
        })
        toast.success(t('Dashboard updated'))
      } else {
        await usersApi.create({
          email: values.email,
          name: values.name,
          role: values.role,
          password: values.password || undefined,
          pageNames: values.role === 'custom' ? values.pageNames : [],
          dashboardIds: values.role === 'custom' ? values.dashboardIds : [],
        })
        toast.success(t('User created'))
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? t('Edit User') : t('Add New User')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('Update the user here.') : t('Create new user here.')}{' '}
            {t("Click save when you're done.")}
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[70vh] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input placeholder='John Doe' autoComplete='off' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Email')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john.doe@gmail.com'
                        disabled={isEdit}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Role')}</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select a role')}
                      items={roles.map(({ label, value, description }) => ({
                        label: `${t(label)} — ${description}`,
                        value,
                      }))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isEdit ? t('New password (optional)') : t('Password (optional)')}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='e.g., S3cur3P@ssw0rd'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedRole === 'custom' && (
                <div className='space-y-4 border-t pt-4'>
                  <p className='text-sm font-semibold'>{t('Access Permissions')}</p>

                  <FormField
                    control={form.control}
                    name='dashboardIds'
                    render={() => (
                      <FormItem>
                        <FormLabel>{t('Dashboards')}</FormLabel>
                        <div className='space-y-2'>
                          {loadingDashboards ? (
                            <p className='text-muted-foreground text-sm'>
                              {t('Loading dashboards...')}
                            </p>
                          ) : dashboards.length === 0 ? (
                            <p className='text-muted-foreground text-sm'>
                              {t('No dashboards available')}
                            </p>
                          ) : (
                            dashboards.map((db) => (
                              <FormField
                                key={db.id}
                                control={form.control}
                                name='dashboardIds'
                                render={({ field }) => (
                                  <FormItem className='flex items-center gap-2 space-y-0'>
                                    <Checkbox
                                      checked={field.value?.includes(db.id)}
                                      onCheckedChange={(checked) =>
                                        field.onChange(
                                          checked
                                            ? [...(field.value ?? []), db.id]
                                            : field.value?.filter((id) => id !== db.id) ?? []
                                        )
                                      }
                                    />
                                    <FormLabel className='cursor-pointer text-sm font-normal'>
                                      {db.name}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))
                          )}
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='pageNames'
                    render={() => (
                      <FormItem>
                        <FormLabel>{t('Pages')}</FormLabel>
                        <div className='space-y-2'>
                          {GRANTABLE_PAGES.map((page) => (
                            <FormField
                              key={page.key}
                              control={form.control}
                              name='pageNames'
                              render={({ field }) => (
                                <FormItem className='flex items-center gap-2 space-y-0'>
                                  <Checkbox
                                    checked={field.value?.includes(page.key)}
                                    onCheckedChange={(checked) =>
                                      field.onChange(
                                        checked
                                          ? [...(field.value ?? []), page.key]
                                          : field.value?.filter((k) => k !== page.key) ?? []
                                      )
                                    }
                                  />
                                  <FormLabel className='cursor-pointer text-sm font-normal'>
                                    {t(page.label)}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form' disabled={saving}>
            {t('Save changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
