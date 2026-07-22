/**
 * Cliente de autenticacion. login/setupPassword usan fetch plano (sin
 * Authorization: aun no hay sesion). me() usa apiFetch porque ya la exige.
 */
import { apiFetch } from './api-fetch'

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
  token: string
  user: AuthUser
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const authApi = {
  login: (email: string, password: string): Promise<LoginResult> =>
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => handle(r)),

  setupPassword: (email: string, password: string): Promise<LoginResult> =>
    fetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => handle(r)),

  me: (): Promise<AuthUser> =>
    apiFetch('/api/auth/me').then((r) => handle(r)),
}
