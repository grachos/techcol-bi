import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlus, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'

const AVAILABLE_DASHBOARDS = [
  { id: 1, name: 'Sales Dashboard' },
  { id: 2, name: 'Analytics Dashboard' },
  { id: 3, name: 'Financial Dashboard' },
  { id: 4, name: 'Inventory Dashboard' },
]

const AVAILABLE_PAGES = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'bi', label: 'BI Dashboard' },
  { name: 'connectors', label: 'Connectors' },
  { name: 'reports', label: 'Reports' },
  { name: 'chats', label: 'Chats' },
]

function buildSchema(t: (k: string) => string) {
  return z.object({
    email: z.email({
      error: (iss) =>
        iss.input === '' ? t('Please enter an email to invite.') : undefined,
    }),
    role: z.enum(['admin', 'custom'], { message: t('Role is required.') }),
    desc: z.string().optional(),
    dashboardIds: z.array(z.number()).default([]),
    pageNames: z.array(z.string()).default([]),
  })
}

type UserInviteForm = z.infer<ReturnType<typeof buildSchema>>

type UserInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersInviteDialog({
  open,
  onOpenChange,
}: UserInviteDialogProps) {
  const { t } = useTranslation()
  const formSchema = buildSchema(t)
  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: 'custom', desc: '', dashboardIds: [], pageNames: [] },
  })

  const selectedRole = form.watch('role')

  const onSubmit = (values: UserInviteForm) => {
    form.reset()
    showSubmittedData(values)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <MailPlus /> {t('Invite User')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Invite new user to join your team by sending them an email invitation. Assign a role to define their access level.'
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-invite-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Email')}</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='eg: john.doe@gmail.com'
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
                      label: `${t(label)} - ${description}`,
                      value,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRole === 'custom' && (
              <>
                <div className='border-t pt-4 mt-2'>
                  <p className='text-sm font-semibold mb-3'>{t('Access Permissions')}</p>
                </div>

                <FormField
                  control={form.control}
                  name='dashboardIds'
                  render={() => (
                    <FormItem>
                      <FormLabel>{t('Dashboards')}</FormLabel>
                      <div className='space-y-2'>
                        {AVAILABLE_DASHBOARDS.map((db) => (
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
                        ))}
                      </div>
                      <FormMessage />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name='desc'
              render={({ field }) => (
                <FormItem className=''>
                  <FormLabel>{t('Description (optional)')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className='resize-none'
                      placeholder={t('Add a personal note to your invitation (optional)')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>{t('Cancel')}</Button>
          </DialogClose>
          <Button type='submit' form='user-invite-form'>
            {t('Invite')} <Send />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
