import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/date-picker'

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z
      .string()
      .min(1, t('Please enter your name.'))
      .min(2, t('Name must be at least 2 characters.'))
      .max(30, t('Name must not be longer than 30 characters.')),
    dob: z.date(t('Please select your date of birth.')),
  })
}

type AccountFormValues = z.infer<ReturnType<typeof buildSchema>>

// This can come from your database or API.
const defaultValues: Partial<AccountFormValues> = {
  name: '',
}

export function AccountForm() {
  const { t } = useTranslation()
  const accountFormSchema = buildSchema(t)
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues,
  })

  function onSubmit(data: AccountFormValues) {
    showSubmittedData(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('Your name')} {...field} />
              </FormControl>
              <FormDescription>
                {t(
                  'This is the name that will be displayed on your profile and in emails.'
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='dob'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>{t('Date of birth')}</FormLabel>
              <DatePicker selected={field.value} onSelect={field.onChange} />
              <FormDescription>
                {t('Your date of birth is used to calculate your age.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>{t('Update account')}</Button>
      </form>
    </Form>
  )
}
