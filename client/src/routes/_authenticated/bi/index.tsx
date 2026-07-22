import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { BiDashboard } from '@/features/bi-dashboard'
import { useAuthStore } from '@/stores/auth-store'
import { isAdmin } from '@/lib/access'

// dashboardId opcional: al entrar desde "Editar" en la galeria se preselecciona
// ese dashboard en lugar del primero.
const biSearchSchema = z.object({
  dashboardId: z.number().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/bi/')({
  // El editor BI es solo para administradores (los custom son de solo lectura).
  beforeLoad: () => {
    if (!isAdmin(useAuthStore.getState().auth.user)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  validateSearch: biSearchSchema,
  component: BiDashboard,
})
