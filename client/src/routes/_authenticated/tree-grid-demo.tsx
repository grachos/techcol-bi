import { createFileRoute } from '@tanstack/react-router'
import { TreeGridDemo } from '@/features/tree-grid-demo'

export const Route = createFileRoute('/_authenticated/tree-grid-demo')({
  component: TreeGridDemo,
})
