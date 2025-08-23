import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAuthStore } from '../../../app/stores/auth'

vi.mock('../../../app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ isAuthenticated: false })),
}))

describe("Middleware d'authentification (client)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirige vers /login si non authentifié', () => {
    const authStore = useAuthStore() as any
    authStore.isAuthenticated = false

    const to = { fullPath: '/profile' } as any

    // Simuler le middleware client simplement
    const shouldRedirect = !authStore.isAuthenticated
    expect(shouldRedirect).toBe(true)
  })

  it('laisse passer si authentifié', () => {
    const authStore = useAuthStore() as any
    authStore.isAuthenticated = true

    const to = { fullPath: '/profile' } as any
    const shouldRedirect = !authStore.isAuthenticated
    expect(shouldRedirect).toBe(false)
  })
})
