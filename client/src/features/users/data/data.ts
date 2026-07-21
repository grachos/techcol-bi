import { Shield, User } from 'lucide-react'
import { type UserStatus, type UserRole } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
])

export const roles: Array<{ label: string; value: UserRole; icon: any; description: string }> = [
  {
    label: 'Administrador',
    value: 'admin',
    icon: Shield,
    description: 'Acceso total al sistema',
  },
  {
    label: 'Usuario Personalizado',
    value: 'custom',
    icon: User,
    description: 'Acceso limitado a dashboards y páginas asignadas',
  },
] as const
