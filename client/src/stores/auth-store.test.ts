import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser = {
  id: 1,
  email: 'user@example.com',
  name: 'Sample User',
  role: 'admin' as const,
  permissions: { pageNames: [], dashboardIds: [] },
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('arranca sin usuario', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('guarda el usuario de la sesion con setUser', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setUser({ ...sampleUser })

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
  })

  it('reset limpia el usuario', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setUser({ ...sampleUser })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  // La sesion vive en una cookie httpOnly: el store no debe persistir nada en
  // el navegador. Si alguien vuelve a meter el token aqui, esto falla.
  it('no persiste nada en document.cookie', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setUser({ ...sampleUser })

    expect(document.cookie).not.toContain('user@example.com')
    expect(Object.keys(useAuthStore.getState().auth)).not.toContain(
      'accessToken'
    )
  })
})
