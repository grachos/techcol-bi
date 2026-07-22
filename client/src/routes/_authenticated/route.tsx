import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { authApi } from '@/lib/auth-api'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    // La sesion vive en una cookie httpOnly que JavaScript no puede leer, asi
    // que la unica forma de saber si hay sesion valida es preguntarle al
    // servidor. /me tambien devuelve rol y permisos, que los guards de las
    // rutas hijas necesitan. Se consulta solo si aun no hay usuario en memoria.
    if (!auth.user?.role) {
      try {
        auth.setUser(await authApi.me())
      } catch {
        auth.reset()
        throw redirect({ to: '/sign-in', search: { redirect: location.href } })
      }
    }
  },
  component: AuthenticatedLayout,
})
