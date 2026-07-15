import { createFileRoute } from '@tanstack/react-router'
import { BiDashboard } from '@/features/bi-dashboard'

export const Route = createFileRoute('/_authenticated/bi/')({
  component: BiDashboard,
})
