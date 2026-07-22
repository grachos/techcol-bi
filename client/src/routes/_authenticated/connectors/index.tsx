import { createFileRoute } from '@tanstack/react-router'
import { Connectors } from '@/features/connectors'
import { requireAdminRoute } from '@/lib/access'

export const Route = createFileRoute('/_authenticated/connectors/')({
  beforeLoad: requireAdminRoute,
  component: Connectors,
})
