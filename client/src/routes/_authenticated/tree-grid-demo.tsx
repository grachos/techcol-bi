import { createFileRoute } from '@tanstack/react-router'
import { TreeGridDemo } from '@/features/tree-grid-demo'
import { requireAdminRoute } from '@/lib/access'

export const Route = createFileRoute('/_authenticated/tree-grid-demo')({
  beforeLoad: requireAdminRoute,
  component: TreeGridDemo,
})
