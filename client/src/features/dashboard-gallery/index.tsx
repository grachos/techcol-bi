import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { LayoutGrid, Eye, Zap, Clock, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dashboardApi, type DashboardSummary } from '@/lib/dashboard-api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function DashboardGallery() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const recent = dashboards
    .filter((d) => d.lastQueriedAt)
    .sort((a, b) => new Date(b.lastQueriedAt!).getTime() - new Date(a.lastQueriedAt!).getTime())[0]

  useEffect(() => {
    loadDashboards()
  }, [])

  const loadDashboards = async () => {
    try {
      setLoading(true)
      const list = await dashboardApi.list()
      setDashboards(list)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setLoading(false)
    }
  }

  const formatLastRefresh = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return t('Just now')
    if (diffMins < 60) return t('{{mins}} minutes ago', { mins: diffMins })
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return t('{{hours}} hours ago', { hours: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    return t('{{days}} days ago', { days: diffDays })
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        {/* Hero section */}
        <div className='pt-4'>
          <div className='flex items-center gap-2 mb-2'>
            <LayoutGrid className='size-6 text-primary' />
            <h1 className='text-4xl font-bold tracking-tight'>{t('My Dashboards')}</h1>
          </div>
          <p className='text-lg text-muted-foreground'>
            {t('View and interact with your dashboards. Edit from BI Dashboard.')}
          </p>
        </div>

        {/* Recently Visited Section */}
        {recent && (
          <Card className='bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30'>
            <CardContent className='p-6'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-2'>
                    <Clock className='size-4 text-primary' />
                    <h2 className='font-semibold text-primary'>{t('Recently Visited')}</h2>
                  </div>
                  <h3 className='text-lg font-bold mb-1'>{recent.name}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {t('Last query executed')} {formatLastRefresh(recent.lastQueriedAt!)}
                  </p>
                </div>
                <Button
                  onClick={() => navigate({ to: `/dashboard/${recent.id}` })}
                  className='gap-2'
                >
                  {t('Continue')}
                  <ChevronRight className='size-4' />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
              <p className='text-muted-foreground'>{t('Loading dashboards...')}</p>
            </div>
          </div>
        ) : dashboards.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20'>
            <LayoutGrid className='size-16 text-muted-foreground/50 mb-4' />
            <h2 className='text-xl font-semibold mb-2'>{t('No dashboards yet')}</h2>
            <p className='text-muted-foreground mb-6'>
              {t('Create your first dashboard in BI Dashboard to see it here.')}
            </p>
            <Button onClick={() => navigate({ to: '/bi' })}>
              {t('Go to BI Dashboard')}
            </Button>
            <Button variant='outline' onClick={() => navigate({ to: '/' })}>
              {t('Back to Dashboards')}
            </Button>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6'>
            {dashboards.map((dashboard) => (
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                onView={() => navigate({ to: `/dashboard/${dashboard.id}` })}
              />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}

interface DashboardCardProps {
  dashboard: DashboardSummary
  onView: () => void
}

function DashboardCard({ dashboard, onView }: DashboardCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-lg group',
        'border-2 hover:border-primary/50'
      )}
    >
      {/* Card Header with color gradient */}
      <div className='h-32 bg-gradient-to-br from-primary/20 to-primary/5 border-b flex items-center justify-center'>
        <LayoutGrid className='size-12 text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all' />
      </div>

      <CardContent className='p-4'>
        {/* Title and Star */}
        <div className='flex items-start justify-between gap-2 mb-2'>
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-lg truncate group-hover:text-primary transition-colors'>
              {dashboard.name}
            </h3>
          </div>
          {dashboard.isFavorite && <Badge className='bg-yellow-500/20 text-yellow-700'>⭐</Badge>}
        </div>

        {/* Tags */}
        {dashboard.tags.length > 0 && (
          <div className='flex flex-wrap gap-1 mb-4'>
            {dashboard.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant='outline' className='text-xs'>
                #{tag}
              </Badge>
            ))}
            {dashboard.tags.length > 3 && (
              <Badge variant='outline' className='text-xs'>
                +{dashboard.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className='flex gap-2 pt-2'>
          <Button
            size='sm'
            className='flex-1'
            onClick={(e) => {
              e.stopPropagation()
              navigate({ to: `/dashboard/${dashboard.id}` })
            }}
          >
            <Eye className='size-4 me-1.5' />
            {t('View')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='flex-1'
            onClick={(e) => {
              e.stopPropagation()
              navigate({ to: '/bi', search: { dashboardId: dashboard.id } })
            }}
          >
            <Zap className='size-4 me-1.5' />
            {t('Edit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
