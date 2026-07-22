import { create } from 'zustand'
import { removeCookie } from '@/lib/cookies'
import { type AuthUser } from '@/lib/auth-api'

// Cookie de la version anterior: guardaba el JWT en claro y accesible desde
// JavaScript. Ya nadie la lee, pero seguiria viva en los navegadores que
// iniciaron sesion antes del cambio, con un token valido hasta 7 dias. Se
// borra al arrancar para no dejar una credencial usable dando vueltas.
const LEGACY_TOKEN_COOKIE = 'thisisjustarandomstring'
removeCookie(LEGACY_TOKEN_COOKIE)

/**
 * Estado de sesion del cliente.
 *
 * El token NO vive aqui: viaja en una cookie httpOnly que emite el servidor y
 * que el navegador adjunta sola en cada peticion del mismo origen. JavaScript
 * no puede leerla, asi que un XSS no puede robar la sesion. Aqui solo queda el
 * usuario (rol y permisos) para pintar el menu y proteger las rutas.
 */
interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    /** Limpia el usuario en memoria. La cookie la borra POST /api/auth/logout. */
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    setUser: (user) =>
      set((state) => ({ ...state, auth: { ...state.auth, user } })),
    reset: () =>
      set((state) => ({ ...state, auth: { ...state.auth, user: null } })),
  },
}))
