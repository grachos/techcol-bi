// El tipo de usuario refleja lo que el backend realmente almacena:
// email, nombre, rol, estado y permisos (dashboards + paginas asignadas).
import { type ManagedUser } from '@/lib/users-api'

export type UserStatus = 'active' | 'inactive'
export type UserRole = 'admin' | 'custom'
export type User = ManagedUser
