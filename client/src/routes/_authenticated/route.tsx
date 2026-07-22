import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { authApi } from '@/lib/auth-api'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
    // Al recargar la app el token persiste pero el usuario (rol/permisos) no.
    // Se restaura desde /me para que los guards de las rutas hijas tengan el
    // rol disponible. Si el token ya no es valido, se cierra sesion.
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
