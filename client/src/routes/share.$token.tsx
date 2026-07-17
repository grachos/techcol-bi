import { createFileRoute, useLoaderData } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { biApi } from '@/lib/bi-api'
import { DashboardView } from '@/features/bi-dashboard/components/dashboard-view'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { Loader } from 'lucide-react'

const ShareRoute = () => {
  const { token } = useLoaderData({ from: '/share/$token' })

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['shared-dashboard', token],
    queryFn: () => biApi.dashboard.getShared(token),
  })

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-screen bg-background'>
        <Loader className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className='flex items-center justify-center h-screen bg-background'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-foreground mb-2'>
            Dashboard no encontrado
          </h1>
          <p className='text-muted-foreground'>
            El link de compartir puede haber expirado o ser inválido
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='h-screen bg-background flex flex-col'>
      {/* Header */}
      <div className='border-b bg-card px-6 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>{(dashboard as any)?.name}</h1>
            <p className='text-xs text-muted-foreground mt-1'>
              Vista de solo lectura • Los cambios no se guardarán
            </p>
          </div>
          <div className='flex gap-2'>
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className='flex-1 overflow-auto'>
        <DashboardView dashboard={dashboard} shareToken={token} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/share/$token')({
  loader: ({ params }) => ({
    token: params.token,
  }),
  component: ShareRoute,
  errorComponent: () => (
    <div className='flex items-center justify-center h-screen bg-background'>
      <div className='text-center'>
        <h1 className='text-2xl font-bold text-foreground mb-2'>
          Error al cargar el dashboard compartido
        </h1>
        <p className='text-muted-foreground'>
          Por favor, intenta con un link diferente
        </p>
      </div>
    </div>
  ),
})
