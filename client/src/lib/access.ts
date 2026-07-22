/**
 * Reglas de acceso del lado del cliente: filtran el menu y protegen rutas.
 * El servidor es la fuente de verdad (rechaza lo no autorizado); esto es UX
 * para no mostrar lo que igual seria bloqueado.
 */
import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { type AuthUser } from './auth-api'

/** Paginas que SOLO puede ver un administrador (nunca asignables a 'custom'). */
export const ADMIN_ONLY_PATHS = [
  '/bi',
  '/connectors',
  '/users',
  '/semantic-layer-demo',
  '/tree-grid-demo',
]

/** Paginas asignables a un usuario 'custom' (clave = primer segmento de la ruta). */
export const GRANTABLE_PAGES = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboards' },
  { key: 'help-center', path: '/help-center', label: 'Help Center' },
] as const

/** Rutas que cualquier usuario autenticado puede abrir (ajustes personales, etc.). */
const ALWAYS_ALLOWED = ['/settings', '/help-center']

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin'
}

/** Clave de pagina (primer segmento) a partir de una ruta. */
function pageKey(path: string): string {
  return path.split('/').filter(Boolean)[0] ?? ''
}

/**
 * ¿El usuario puede abrir esta ruta? Admin: todo. Custom: rutas no
 * admin-only, y si es una pagina asignable, debe tenerla en sus permisos.
 */
export function canAccessPath(
  user: AuthUser | null | undefined,
  path: string
): boolean {
  if (isAdmin(user)) return true
  if (!user) return false

  const key = pageKey(path)
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) return false
  if (ALWAYS_ALLOWED.some((p) => path.startsWith(p))) return true

  const grantable = GRANTABLE_PAGES.find((g) => g.key === key)
  if (grantable) return user.permissions?.pageNames?.includes(key) ?? false

  // Rutas no clasificadas: por defecto solo admin (fail-closed).
  return false
}

/** Guard de ruta admin-only para usar en beforeLoad; redirige si no es admin. */
export function requireAdminRoute(): void {
  if (!isAdmin(useAuthStore.getState().auth.user)) {
    throw redirect({ to: '/dashboard' })
  }
}
