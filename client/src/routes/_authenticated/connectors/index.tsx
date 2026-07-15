import { createFileRoute } from '@tanstack/react-router'
import { Connectors } from '@/features/connectors'

export const Route = createFileRoute('/_authenticated/connectors/')({
  component: Connectors,
})
