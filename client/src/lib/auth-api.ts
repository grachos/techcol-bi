/**
 * Cliente de autenticacion.
 *
 * No maneja tokens: el servidor entrega la sesion como cookie httpOnly y el
 * navegador la adjunta sola. Por eso todo va con fetch plano + credentials,
 * sin cabecera Authorization.
 */

export interface UserPermissions {
  pageNames: string[]
  dashboardIds: number[]
}

export interface AuthUser {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'custom'
  permissions: UserPermissions
}

export interface LoginResult {
  user: AuthUser
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

function post(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const authApi = {
  login: (email: string, password: string): Promise<LoginResult> =>
    post('/api/auth/login', { email, password }).then((r) => handle(r)),

  setupPassword: (email: string, password: string): Promise<LoginResult> =>
    post('/api/auth/setup-password', { email, password }).then((r) => handle(r)),

  logout: (): Promise<{ ok: true }> =>
    post('/api/auth/logout').then((r) => handle(r)),

  /**
   * Usuario de la sesion actual. Usa fetch plano a proposito: es la sonda con
   * la que el guard de rutas decide si hay sesion, y debe poder recibir un 401
   * sin disparar la redireccion global de apiFetch.
   */
  me: (): Promise<AuthUser> =>
    fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => handle(r)),
}
