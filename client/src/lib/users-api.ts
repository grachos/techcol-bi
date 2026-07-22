/**
 * Cliente del modulo de usuarios (backend Express, solo admin).
 */
import { apiFetch } from './api-fetch'

export type UserRole = 'admin' | 'custom'
export type UserStatus = 'active' | 'inactive'

export interface UserPermissions {
  dashboardIds: number[]
  pageNames: string[]
}

export interface ManagedUser {
  id: number
  email: string
  name: string | null
  role: UserRole
  status: UserStatus
  hasPassword: boolean
  permissions: UserPermissions
}

export interface CreateUserInput {
  email: string
  name?: string
  role: UserRole
  password?: string
  pageNames: string[]
  dashboardIds: number[]
}

export interface UpdateUserInput {
  name?: string
  role?: UserRole
  status?: UserStatus
  password?: string
  pageNames?: string[]
  dashboardIds?: number[]
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const usersApi = {
  list: (): Promise<ManagedUser[]> =>
    apiFetch('/api/users').then((r) => handle(r)),

  create: (input: CreateUserInput): Promise<{ id: number }> =>
    apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle(r)),

  update: (id: number, input: UpdateUserInput): Promise<{ ok: true }> =>
    apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle(r)),

  remove: (id: number): Promise<{ ok: true }> =>
    apiFetch(`/api/users/${id}`, { method: 'DELETE' }).then((r) => handle(r)),
}
