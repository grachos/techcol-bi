import { createFileRoute } from '@tanstack/react-router'
import { SemanticLayerDemo } from '@/features/semantic-layer-demo'
import { requireAdminRoute } from '@/lib/access'

export const Route = createFileRoute('/_authenticated/semantic-layer-demo')({
  beforeLoad: requireAdminRoute,
  component: SemanticLayerDemo,
})
