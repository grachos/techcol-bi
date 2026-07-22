import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Users } from '@/features/users'
import { roles } from '@/features/users/data/data'
import { useAuthStore } from '@/stores/auth-store'
import { isAdmin } from '@/lib/access'

const usersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  // Facet filters
  status: z
    .array(
      z.union([
        z.literal('active'),
        z.literal('inactive'),
      ])
    )
    .optional()
    .catch([]),
  role: z
    .array(z.enum(roles.map((r) => r.value as (typeof roles)[number]['value'])))
    .optional()
    .catch([]),
  // Per-column text filter (example for username)
  username: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/users/')({
  // Solo administradores. El servidor tambien lo exige (requireAdmin); esto
  // evita mostrar la pantalla a un usuario custom.
  beforeLoad: () => {
    if (!isAdmin(useAuthStore.getState().auth.user)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  validateSearch: usersSearchSchema,
  component: Users,
})
