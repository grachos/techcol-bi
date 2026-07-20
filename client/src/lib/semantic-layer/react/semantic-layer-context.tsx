import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { SemanticModel } from '../semantic-model'

const SemanticLayerContext = createContext<SemanticModel | null>(null)

interface SemanticLayerProviderProps {
  model: SemanticModel
  children: ReactNode
}

export function SemanticLayerProvider({ model, children }: SemanticLayerProviderProps) {
  return <SemanticLayerContext.Provider value={model}>{children}</SemanticLayerContext.Provider>
}

/**
 * Devuelve el SemanticModel del contexto y suscribe al componente a sus
 * cambios (nueva/editada/borrada medida, dimension, kpi) via
 * useSyncExternalStore, para que cualquier widget que consuma el modelo se
 * re-renderice automaticamente sin wiring manual de eventos.
 */
export function useSemanticModel(): SemanticModel {
  const model = useContext(SemanticLayerContext)
  if (!model) {
    throw new Error('useSemanticModel debe usarse dentro de un <SemanticLayerProvider>')
  }
  useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion)
  return model
}
