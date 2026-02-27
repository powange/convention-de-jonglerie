import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireUserSession = vi.hoisted(() => vi.fn())

// Mock de nuxt-auth-utils (re-exporté via #imports pour les auto-imports serveur)
vi.mock('nuxt-auth-utils', () => ({
  requireUserSession: mockRequireUserSession,
  getUserSession: vi.fn(),
  setUserSession: vi.fn(),
  clearUserSession: vi.fn(),
}))

import { requireGlobalAdminWithDbCheck } from '../../../../server/utils/admin-auth'

const prismaMock = (globalThis as any).prisma

describe('admin-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireGlobalAdminWithDbCheck', () => {
    const mockAdminUser = {
      id: 1,
      email: 'admin@example.com',
      pseudo: 'admin',
      nom: 'Admin',
      prenom: 'Super',
      isGlobalAdmin: true,
    }

    const mockNonAdminUser = {
      id: 2,
      email: 'user@example.com',
      pseudo: 'user',
      nom: 'User',
      prenom: 'Normal',
      isGlobalAdmin: false,
    }

    const mockEvent = {} as any

    it("devrait retourner les infos admin si l'utilisateur est admin global en DB", async () => {
      mockRequireUserSession.mockResolvedValueOnce({ user: { id: 1 } })
      prismaMock.user.findUnique.mockResolvedValue(mockAdminUser)

      const result = await requireGlobalAdminWithDbCheck(mockEvent)

      expect(result).toEqual({
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        nom: 'Admin',
        prenom: 'Super',
        isGlobalAdmin: true,
      })
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          pseudo: true,
          nom: true,
          prenom: true,
          isGlobalAdmin: true,
        },
      })
    })

    it('devrait lancer une erreur 401 si pas de session utilisateur', async () => {
      mockRequireUserSession.mockResolvedValueOnce({ user: null })

      await expect(requireGlobalAdminWithDbCheck(mockEvent)).rejects.toThrow('Non authentifié')
    })

    it('devrait lancer une erreur 401 si user.id est absent', async () => {
      mockRequireUserSession.mockResolvedValueOnce({ user: {} })

      await expect(requireGlobalAdminWithDbCheck(mockEvent)).rejects.toThrow('Non authentifié')
    })

    it("devrait lancer une erreur 403 si l'utilisateur n'est pas admin en DB", async () => {
      mockRequireUserSession.mockResolvedValueOnce({ user: { id: 2 } })
      prismaMock.user.findUnique.mockResolvedValue(mockNonAdminUser)

      await expect(requireGlobalAdminWithDbCheck(mockEvent)).rejects.toThrow(
        'Accès refusé - Droits super administrateur requis'
      )
    })

    it("devrait lancer une erreur 403 si l'utilisateur n'existe pas en DB", async () => {
      mockRequireUserSession.mockResolvedValueOnce({ user: { id: 999 } })
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(requireGlobalAdminWithDbCheck(mockEvent)).rejects.toThrow(
        'Accès refusé - Droits super administrateur requis'
      )
    })

    it('devrait propager les erreurs de requireUserSession', async () => {
      mockRequireUserSession.mockRejectedValueOnce(new Error('Session expirée'))

      await expect(requireGlobalAdminWithDbCheck(mockEvent)).rejects.toThrow('Session expirée')
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })
  })
})
