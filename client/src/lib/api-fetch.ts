import { useAuthStore } from '@/stores/auth-store'

/**
 * fetch() que agrega el Authorization: Bearer <token> de la sesion actual.
 * Si el servidor responde 401 (sesion invalida/expirada), limpia la sesion
 * y manda al login -- evita que la UI quede mostrando datos obsoletos con
 * una sesion que el backend ya rechaza.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().auth.accessToken
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers }).then((res) => {
    if (res.status === 401) {
      useAuthStore.getState().auth.reset()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.href = '/sign-in'
      }
    }
    return res
  })
}
