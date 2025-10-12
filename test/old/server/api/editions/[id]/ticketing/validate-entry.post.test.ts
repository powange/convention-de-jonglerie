import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des permissions
vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn(),
}))

import { canAccessEditionData } from '../../../../../../../server/utils/permissions/edition-permissions'
import { prismaMock } from '../../../../../../__mocks__/prisma'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/validate-entry.post'

const mockCanAccessEditionData = canAccessEditionData as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

describe('/api/editions/[id]/ticketing/validate-entry POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    global.readBody = vi.fn()
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  describe('Validation de tickets', () => {
    it('devrait valider plusieurs tickets avec succès', async () => {
      const requestBody = {
        participantIds: [1, 2, 3],
        type: 'ticket',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 3 })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        validated: 3,
        message: '3 participants validés',
      })

      expect(prismaMock.ticketingOrderItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2, 3] },
          order: { editionId: 1 },
        },
        data: {
          entryValidated: true,
          entryValidatedAt: expect.any(Date),
          entryValidatedBy: 1,
        },
      })
    })

    it('devrait valider un seul ticket', async () => {
      const requestBody = {
        participantIds: [1],
        type: 'ticket',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 1 })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        validated: 1,
        message: '1 participant validé',
      })
    })

    it('devrait utiliser type="ticket" par défaut', async () => {
      const requestBody = {
        participantIds: [1, 2],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 2 })

      await handler(mockEvent as any)

      expect(prismaMock.ticketingOrderItem.updateMany).toHaveBeenCalled()
    })
  })

  describe('Validation de bénévoles', () => {
    it('devrait valider plusieurs bénévoles avec succès', async () => {
      const requestBody = {
        participantIds: [1, 2, 3],
        type: 'volunteer',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 3 })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        validated: 3,
        message: '3 bénévoles validés',
      })

      expect(prismaMock.editionVolunteerApplication.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2, 3] },
          editionId: 1,
          status: 'ACCEPTED',
        },
        data: {
          entryValidated: true,
          entryValidatedAt: expect.any(Date),
          entryValidatedBy: 1,
        },
      })
    })

    it('devrait valider un seul bénévole', async () => {
      const requestBody = {
        participantIds: [1],
        type: 'volunteer',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 1 })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        validated: 1,
        message: '1 bénévole validé',
      })
    })
  })

  describe('Authentification et permissions', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      const mockEventWithoutUser = { context: {} }
      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
    })

    it("devrait rejeter si l'utilisateur n'a pas les permissions", async () => {
      mockCanAccessEditionData.mockResolvedValue(false)

      const requestBody = {
        participantIds: [1],
      }

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Droits insuffisants pour accéder à cette fonctionnalité'
      )
    })
  })

  describe('Validation des paramètres', () => {
    it("devrait rejeter si ID d'édition invalide", async () => {
      global.getRouterParam.mockReturnValue('0')

      await expect(handler(mockEvent as any)).rejects.toThrow('Edition invalide')
    })

    it('devrait rejeter si participantIds est vide', async () => {
      const requestBody = {
        participantIds: [],
      }

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si participantIds manquant', async () => {
      const requestBody = {}

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si type invalide', async () => {
      const requestBody = {
        participantIds: [1],
        type: 'invalid',
      }

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait accepter les types valides', async () => {
      for (const type of ['ticket', 'volunteer']) {
        const requestBody = {
          participantIds: [1],
          type,
        }

        global.readBody.mockResolvedValue(requestBody)

        if (type === 'volunteer') {
          prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 1 })
        } else {
          prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 1 })
        }

        const result = await handler(mockEvent as any)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const requestBody = {
        participantIds: [1],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Erreur lors de la validation des entrées'
      )
    })

    it('devrait logger les erreurs de base de données', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const requestBody = {
        participantIds: [1],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(mockEvent as any)).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith('Database validate entry error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('Cas limites', () => {
    it('devrait gérer 0 validations (aucun participant trouvé)', async () => {
      const requestBody = {
        participantIds: [999],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 0 })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        validated: 0,
        message: '0 participant validé',
      })
    })

    it('devrait gérer un grand nombre de participants', async () => {
      const participantIds = Array.from({ length: 100 }, (_, i) => i + 1)

      const requestBody = {
        participantIds,
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 100 })

      const result = await handler(mockEvent as any)

      expect(result.validated).toBe(100)
    })
  })

  describe('Vérification des permissions par édition', () => {
    it('devrait vérifier les permissions pour la bonne édition', async () => {
      global.getRouterParam.mockReturnValue('42')

      const requestBody = {
        participantIds: [1],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 1 })

      await handler(mockEvent as any)

      expect(mockCanAccessEditionData).toHaveBeenCalledWith(42, 1, mockEvent)
    })
  })
})
