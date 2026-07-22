import { useAuthStore } from '@/stores/auth-store'

/**
 * fetch() para la API autenticada.
 *
 * No agrega ninguna cabecera de sesion: el token vive en una cookie httpOnly
 * que el navegador adjunta solo (credentials: 'same-origin'), fuera del
 * alcance de JavaScript.
 *
 * Si el servidor responde 401 (sesion invalida, expirada o cuenta
 * desactivada), limpia la sesion y manda al login -- evita que la UI quede
 * mostrando datos obsoletos con una sesion que el backend ya rechaza.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, credentials: 'same-origin' }).then((res) => {
    if (res.status === 401) {
      useAuthStore.getState().auth.reset()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.href = '/sign-in'
      }
    }
    return res
  })
}
