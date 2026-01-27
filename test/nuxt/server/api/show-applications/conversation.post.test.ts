import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/show-applications/[applicationId]/conversation.post'

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

    if (applicationId === 9999) {
      const error = new Error('Candidature introuvable')
      ;(error as any).statusCode = 404
      throw error
    }

    if (applicationId === 8888) {
      const error = new Error('Accès non autorisé')
      ;(error as any).statusCode = 403
      throw error
    }

    return {
      application: { id: applicationId, userId: 1 },
      isArtist: userId === 1,
      isOrganizer: userId === 2,
      isAdminMode: false,
      editionId: 1,
      conventionId: 1,
    }
  }),
}))

const mockEnsureConversation = vi.fn()

vi.mock('../../../../../server/utils/messenger-helpers', () => ({
  ensureShowApplicationConversation: (...args: any[]) => mockEnsureConversation(...args),
}))

describe('/api/show-applications/[applicationId]/conversation POST', () => {
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
    mockEnsureConversation.mockReset()
  })

  describe('Authentification', () => {
    it("devrait rejeter avec 401 si l'utilisateur n'est pas authentifié", async () => {
      const mockEvent = {
        context: {},
      }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')

      expect(mockEnsureConversation).not.toHaveBeenCalled()
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

  describe('Création de conversation', () => {
    it("devrait créer une conversation si elle n'existe pas", async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      mockEnsureConversation.mockResolvedValue('new-conv-uuid-123')

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        conversationId: 'new-conv-uuid-123',
      })

      expect(mockEnsureConversation).toHaveBeenCalledWith(1, mockArtist.id)
    })

    it('devrait retourner la conversation existante si elle existe déjà', async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      mockEnsureConversation.mockResolvedValue('existing-conv-uuid-456')

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        conversationId: 'existing-conv-uuid-456',
      })
    })
  })

  describe('Accès par différents rôles', () => {
    it("devrait permettre à l'artiste de créer/rejoindre la conversation", async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      mockEnsureConversation.mockResolvedValue('conv-uuid-artist')

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(mockEnsureConversation).toHaveBeenCalledWith(1, mockArtist.id)
    })

    it("devrait permettre à l'organisateur de créer/rejoindre la conversation", async () => {
      const mockEvent = {
        context: {
          user: mockOrganizer,
          params: { applicationId: '1' },
        },
      }

      mockEnsureConversation.mockResolvedValue('conv-uuid-organizer')

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(mockEnsureConversation).toHaveBeenCalledWith(1, mockOrganizer.id)
    })
  })

  describe("Gestion d'erreurs", () => {
    it('devrait gérer les erreurs de ensureShowApplicationConversation', async () => {
      const mockEvent = {
        context: {
          user: mockArtist,
          params: { applicationId: '1' },
        },
      }

      mockEnsureConversation.mockRejectedValue(new Error('Erreur de création'))

      // wrapApiHandler transforme les erreurs non-HTTP en "Erreur serveur interne"
      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })
  })
})
