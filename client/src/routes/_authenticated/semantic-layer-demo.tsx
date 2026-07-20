import { createFileRoute } from '@tanstack/react-router'
import { SemanticLayerDemo } from '@/features/semantic-layer-demo'

export const Route = createFileRoute('/_authenticated/semantic-layer-demo')({
  component: SemanticLayerDemo,
})
