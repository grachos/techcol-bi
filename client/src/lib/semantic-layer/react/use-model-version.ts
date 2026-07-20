import { useSyncExternalStore } from 'react'
import type { SemanticModel } from '../semantic-model'

export function useModelVersion(model: SemanticModel | null): number {
  return useSyncExternalStore(
    model?.subscribe ?? (() => () => {}),
    model?.getVersion ?? (() => 0),
    model?.getVersion ?? (() => 0)
  )
}
