import { useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>{t('Sign in')}</CardTitle>
          <CardDescription>
            {t('Enter your email and password below to log into')}{' '}
            <br className='max-sm:hidden' /> {t('your account.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
