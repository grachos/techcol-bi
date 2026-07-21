'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { dashboardApi, type DashboardSummary } from '@/lib/dashboard-api'
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

const AVAILABLE_PAGES = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'bi', label: 'BI Dashboard' },
  { name: 'connectors', label: 'Connectors' },
  { name: 'reports', label: 'Reports' },
  { name: 'chats', label: 'Chats' },
]

function buildSchema(t: (k: string) => string) {
  return z
    .object({
      firstName: z.string().min(1, t('First Name is required.')),
      lastName: z.string().min(1, t('Last Name is required.')),
      username: z.string().min(1, t('Username is required.')),
      phoneNumber: z.string().min(1, t('Phone number is required.')),
      email: z.email({
        error: (iss) => (iss.input === '' ? t('Email is required.') : undefined),
      }),
      password: z.string().transform((pwd) => pwd.trim()),
      role: z.enum(['admin', 'custom'], { message: t('Role is required.') }),
      confirmPassword: z.string().transform((pwd) => pwd.trim()),
      dashboardIds: z.array(z.number()).default([]),
      pageNames: z.array(z.string()).default([]),
      isEdit: z.boolean(),
    })
    .refine(
      (data) => {
        if (data.isEdit && !data.password) return true
        return data.password.length > 0
      },
      {
        message: t('Password is required.'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return password.length >= 8
      },
      {
        message: t('Password must be at least 8 characters long.'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return /[a-z]/.test(password)
      },
      {
        message: t('Password must contain at least one lowercase letter.'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return /\d/.test(password)
      },
      {
        message: t('Password must contain at least one number.'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password, confirmPassword }) => {
        if (isEdit && !password) return true
        return password === confirmPassword
      },
      {
        message: t("Passwords don't match."),
        path: ['confirmPassword'],
      }
    )
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
  const isEdit = !!currentRow
  const [availableDashboards, setAvailableDashboards] = useState<DashboardSummary[]>([])
  const [loadingDashboards, setLoadingDashboards] = useState(false)

  useEffect(() => {
    if (open) {
      loadDashboards()
    }
  }, [open])

  const loadDashboards = async () => {
    try {
      setLoadingDashboards(true)
      const dashboards = await dashboardApi.list()
      setAvailableDashboards(dashboards)
    } catch (error) {
      console.error('Error loading dashboards:', error)
    } finally {
      setLoadingDashboards(false)
    }
  }

  const formSchema = buildSchema(t)
  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          ...currentRow,
          password: '',
          confirmPassword: '',
          dashboardIds: currentRow?.permissions?.dashboardIds ?? [],
          pageNames: currentRow?.permissions?.pageNames ?? [],
          isEdit,
        }
      : {
          firstName: '',
          lastName: '',
          username: '',
          email: '',
          role: 'custom',
          phoneNumber: '',
          password: '',
          confirmPassword: '',
          dashboardIds: [],
          pageNames: [],
          isEdit,
        },
  })

  const selectedRole = form.watch('role')

  const onSubmit = (values: UserForm) => {
    form.reset()
    showSubmittedData(values)
    onOpenChange(false)
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

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
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('First Name')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='John'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('Last Name')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Doe'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('Username')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john_doe'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>{t('Email')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john.doe@gmail.com'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('Phone Number')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='+123456789'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>{t('Role')}</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select a role')}
                      className='col-span-4'
                      items={roles.map(({ label, value, description }) => ({
                        label: `${t(label)} - ${description}`,
                        value,
                      }))}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              {selectedRole === 'custom' && (
                <>
                  <div className='col-span-6 border-t pt-4 mt-2'>
                    <p className='text-sm font-semibold mb-3'>{t('Access Permissions')}</p>
                  </div>

                  <FormField
                    control={form.control}
                    name='dashboardIds'
                    render={() => (
                      <FormItem className='grid grid-cols-6 gap-x-4 gap-y-2'>
                        <FormLabel className='col-span-2 text-end pt-2'>
                          {t('Dashboards')}
                        </FormLabel>
                        <div className='col-span-4 space-y-2'>
                          {loadingDashboards ? (
                            <p className='text-sm text-muted-foreground'>{t('Loading dashboards...')}</p>
                          ) : availableDashboards.length === 0 ? (
                            <p className='text-sm text-muted-foreground'>{t('No dashboards available')}</p>
                          ) : (
                            availableDashboards.map((db) => (
                              <FormField
                                key={db.id}
                                control={form.control}
                                name='dashboardIds'
                                render={({ field }) => (
                                  <FormItem className='flex items-center gap-2 space-y-0'>
                                    <Checkbox
                                      checked={field.value?.includes(db.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...(field.value ?? []), db.id])
                                        } else {
                                          field.onChange(field.value?.filter((id) => id !== db.id) ?? [])
                                        }
                                      }}
                                    />
                                    <FormLabel className='text-sm font-normal cursor-pointer'>
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
                      <FormItem className='grid grid-cols-6 gap-x-4 gap-y-2'>
                        <FormLabel className='col-span-2 text-end pt-2'>
                          {t('Pages')}
                        </FormLabel>
                        <div className='col-span-4 space-y-2'>
                          {AVAILABLE_PAGES.map((page) => (
                            <FormField
                              key={page.name}
                              control={form.control}
                              name='pageNames'
                              render={({ field }) => (
                                <FormItem className='flex items-center gap-2 space-y-0'>
                                  <Checkbox
                                    checked={field.value?.includes(page.name)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...(field.value ?? []), page.name])
                                      } else {
                                        field.onChange(field.value?.filter((name) => name !== page.name) ?? [])
                                      }
                                    }}
                                  />
                                  <FormLabel className='text-sm font-normal cursor-pointer'>
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
                </>
              )}
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('Password')}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='e.g., S3cur3P@ssw0rd'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {t('Confirm Password')}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        disabled={!isPasswordTouched}
                        placeholder='e.g., S3cur3P@ssw0rd'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form'>
            {t('Save changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
