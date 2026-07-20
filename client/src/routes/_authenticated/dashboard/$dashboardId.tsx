import { createFileRoute } from '@tanstack/react-router'
import { DashboardViewer } from '@/features/dashboard-viewer'

export const Route = createFileRoute('/_authenticated/dashboard/$dashboardId')({
  component: DashboardViewer,
})
