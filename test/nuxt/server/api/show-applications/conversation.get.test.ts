import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/show-applications/[applicationId]/conversation.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const error = new Error('Non authentifié')
      ;(error as any).statusCode = 401
      throw error
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../server/utils/show-application-helpers', () => ({
  requireShowApplicationAccess: vi.fn(async (event: any, userId: number) => {
    const applicationId = parseInt(event.context.params?.applicationId)

    if (isNaN(applicationId)) {
      const error = new Error('ID de candidature invalide')
      ;(error as any).statusCode = 400
      throw error
    }

    // Simuler une candidature non trouvée
    if (applicationId === 9999) {
      const error = new Error('Candidature introuvable')
      ;(error as any).statusCode = 404
      throw error
    }

    // Simuler un accès refusé pour applicationId 8888
    if (applicationId === 8888) {
      const error = new Error('Accès non autorisé')
      ;(error as any).statusCode = 403
      throw error
    }

    return {
      application: { id: applicationId, userId },
      isArtist: userId === 1,
      isOrganizer: userId === 2,
      isAdminMode: false,
      editionId: 1,
      conventionId: 1,
    }
  }),
}))

describe('/api/show-applications/[applicationId]/conversation GET', () => {
  const mockArtist = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'artistuser',
    isGlobalAdmin: false,
  }

  const mockOrganizer = {
    id: 2,
    email: 'organizer@example.com',
    pseudo: 'organizeruser',
    isGlobalAdmin: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it("devrait rejeter avec 401 si l'utilisateur n'est pas authentifié", async () => {
      const mockEvent = {
        context: {},
      }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')

      expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('devrait rejeter avec 400 si applicationId est invalide', async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: 'invalid' },
        },
      }

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de candidature invalide')
    })

    it('devrait rejeter avec 404 si la candidature est introuvable', async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '9999' },
        },
      }

      await expect(handler(mockEvent as any)).rejects.toThrow('Candidature introuvable')
    })

    it("devrait rejeter avec 403 si l'utilisateur n'a pas accès", async () => {
      const mockEvent = {
        context: {
          user: { id: 999, email: 'other@example.com', pseudo: 'other' },
          params: { applicationId: '8888' },
        },
      }

      await expect(handler(mockEvent as any)).rejects.toThrow('Accès non autorisé')
    })
  })

  describe('Vérification de conversation existante', () => {
    it("devrait retourner exists: false si aucune conversation n'existe", async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      prismaMock.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        data: {
          exists: false,
          conversationId: null,
        },
      })

      expect(prismaMock.conversation.findUnique).toHaveBeenCalledWith({
        where: { showApplicationId: 1 },
        select: { id: true },
      })
    })

    it('devrait retourner exists: true avec conversationId si une conversation existe', async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-uuid-123',
      })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        data: {
          exists: true,
          conversationId: 'conv-uuid-123',
        },
      })
    })
  })

  describe('Accès par différents rôles', () => {
    it("devrait permettre à l'artiste de vérifier sa conversation", async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-uuid-123',
      })

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.exists).toBe(true)
    })

    it("devrait permettre à l'organisateur de vérifier la conversation", async () => {
      const mockEvent = {
        context: {
          user: mockOrganizer,
          params: { applicationId: '1' },
        },
      }

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-uuid-456',
      })

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.exists).toBe(true)
    })
  })
})
