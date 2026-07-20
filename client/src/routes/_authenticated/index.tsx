import { createFileRoute } from '@tanstack/react-router'
import { DashboardGallery } from '@/features/dashboard-gallery'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardGallery,
})
