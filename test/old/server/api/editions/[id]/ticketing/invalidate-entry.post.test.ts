import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des permissions
vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn(),
}))

import { canAccessEditionData } from '../../../../../../../server/utils/permissions/edition-permissions'
import { prismaMock } from '../../../../../../__mocks__/prisma'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/invalidate-entry.post'

const mockCanAccessEditionData = canAccessEditionData as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

describe('/api/editions/[id]/ticketing/invalidate-entry POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    global.readBody = vi.fn()
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  describe('Invalidation de tickets', () => {
    it('devrait invalider un ticket avec succès', async () => {
      const requestBody = {
        participantId: 1,
        type: 'ticket',
      }

      const mockOrderItem = {
        id: 1,
        orderId: 1,
        tierId: 1,
        quantity: 1,
        entryValidated: true,
        entryValidatedAt: new Date(),
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(mockOrderItem as any)
      prismaMock.ticketingOrderItem.update.mockResolvedValue(mockOrderItem as any)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        message: 'Entrée dévalidée avec succès',
      })

      expect(prismaMock.ticketingOrderItem.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          order: { editionId: 1 },
        },
      })

      expect(prismaMock.ticketingOrderItem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          entryValidated: false,
          entryValidatedAt: null,
        },
      })
    })

    it('devrait rejeter si le ticket est introuvable', async () => {
      const requestBody = {
        participantId: 999,
        type: 'ticket',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow('Participant introuvable')
    })
  })

  describe('Invalidation de bénévoles', () => {
    it('devrait invalider un bénévole avec succès', async () => {
      const requestBody = {
        participantId: 1,
        type: 'volunteer',
      }

      const mockApplication = {
        id: 1,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        entryValidated: true,
        entryValidatedAt: new Date(),
        entryValidatedBy: 1,
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.editionVolunteerApplication.update.mockResolvedValue(mockApplication as any)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        message: 'Entrée dévalidée avec succès',
      })

      expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          editionId: 1,
          status: 'ACCEPTED',
        },
      })

      expect(prismaMock.editionVolunteerApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          entryValidated: false,
          entryValidatedAt: null,
          entryValidatedBy: null,
        },
      })
    })

    it('devrait rejeter si le bénévole est introuvable', async () => {
      const requestBody = {
        participantId: 999,
        type: 'volunteer',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow('Bénévole introuvable')
    })

    it('devrait utiliser type="volunteer" par défaut', async () => {
      const requestBody = {
        participantId: 1,
      }

      const mockApplication = {
        id: 1,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        entryValidated: true,
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.editionVolunteerApplication.update.mockResolvedValue(mockApplication as any)

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalled()
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
        participantId: 1,
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

    it('devrait rejeter si participantId manquant', async () => {
      const requestBody = {}

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si type invalide', async () => {
      const requestBody = {
        participantId: 1,
        type: 'invalid',
      }

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait accepter les types valides', async () => {
      for (const type of ['ticket', 'volunteer']) {
        const requestBody = {
          participantId: 1,
          type,
        }

        global.readBody.mockResolvedValue(requestBody)

        if (type === 'volunteer') {
          prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({
            id: 1,
            status: 'ACCEPTED',
          } as any)
          prismaMock.editionVolunteerApplication.update.mockResolvedValue({} as any)
        } else {
          prismaMock.ticketingOrderItem.findFirst.mockResolvedValue({ id: 1 } as any)
          prismaMock.ticketingOrderItem.update.mockResolvedValue({} as any)
        }

        const result = await handler(mockEvent as any)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const requestBody = {
        participantId: 1,
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockEvent as any)).rejects.toThrow(
        "Erreur lors de la dévalidation de l'entrée"
      )
    })

    it('devrait logger les erreurs de base de données', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const requestBody = {
        participantId: 1,
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockEvent as any)).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith('Invalidate entry error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('Vérification des permissions par édition', () => {
    it('devrait vérifier les permissions pour la bonne édition', async () => {
      global.getRouterParam.mockReturnValue('42')

      const requestBody = {
        participantId: 1,
      }

      const mockApplication = {
        id: 1,
        status: 'ACCEPTED',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.editionVolunteerApplication.update.mockResolvedValue(mockApplication as any)

      await handler(mockEvent as any)

      expect(mockCanAccessEditionData).toHaveBeenCalledWith(42, 1, mockEvent)
    })
  })
})
