import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de clearUserSession - DOIT être avant l'import du handler
vi.mock('nuxt-auth-utils', () => ({
  clearUserSession: vi.fn(),
}))

import logoutHandler from '../../../../../server/api/auth/logout.post'

describe('API Logout', () => {
  let clearUserSessionMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const authUtils = await import('nuxt-auth-utils')
    clearUserSessionMock = authUtils.clearUserSession as ReturnType<typeof vi.fn>
  })

  it('devrait déconnecter un utilisateur avec succès', async () => {
    clearUserSessionMock.mockResolvedValueOnce(undefined)

    const mockEvent = {
      context: {
        user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
      },
    }

    const result = await logoutHandler(mockEvent)

    expect(result).toEqual({ success: true })
    expect(clearUserSessionMock).toHaveBeenCalledWith(mockEvent)
    expect(clearUserSessionMock).toHaveBeenCalledTimes(1)
  })

  it('devrait fonctionner même sans utilisateur connecté', async () => {
    clearUserSessionMock.mockResolvedValueOnce(undefined)

    const mockEvent = {
      context: {},
    }

    const result = await logoutHandler(mockEvent)

    expect(result).toEqual({ success: true })
    expect(clearUserSessionMock).toHaveBeenCalledWith(mockEvent)
  })

  it('devrait gérer les erreurs de clearUserSession', async () => {
    clearUserSessionMock.mockRejectedValueOnce(new Error('Session error'))

    const mockEvent = {
      context: {
        user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
      },
    }

    await expect(logoutHandler(mockEvent)).rejects.toThrow('Session error')
    expect(clearUserSessionMock).toHaveBeenCalledWith(mockEvent)
  })

  it('devrait appeler clearUserSession une seule fois', async () => {
    clearUserSessionMock.mockResolvedValueOnce(undefined)

    const mockEvent = {
      context: {
        user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
      },
    }

    await logoutHandler(mockEvent)

    expect(clearUserSessionMock).toHaveBeenCalledTimes(1)
  })

  it('devrait retourner success: true même si clearUserSession ne retourne rien', async () => {
    clearUserSessionMock.mockResolvedValueOnce(undefined)

    const mockEvent = {}

    const result = await logoutHandler(mockEvent)

    expect(result).toHaveProperty('success')
    expect(result.success).toBe(true)
  })
})
