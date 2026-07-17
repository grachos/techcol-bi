import { createContext, useContext } from 'react'

/**
 * Token del dashboard compartido, disponible para los widgets descendientes
 * sin tener que pasarlo por props en cada componente (chart/stat/combo/...).
 * null = vista privada autenticada (comportamiento normal).
 */
const ShareTokenContext = createContext<string | null>(null)

export const ShareTokenProvider = ShareTokenContext.Provider

export function useShareToken(): string | null {
  return useContext(ShareTokenContext)
}
