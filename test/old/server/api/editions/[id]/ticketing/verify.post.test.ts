import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des permissions
vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn(),
}))

import { canAccessEditionData } from '../../../../../../../server/utils/permissions/edition-permissions'
import { prismaMock } from '../../../../../../__mocks__/prisma'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/verify.post'

const mockCanAccessEditionData = canAccessEditionData as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

describe('/api/editions/[id]/ticketing/verify POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    global.readBody = vi.fn()
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  describe('Vérification QR code bénévole', () => {
    it('devrait trouver un bénévole avec QR code valide', async () => {
      const requestBody = {
        qrCode: 'volunteer-123',
      }

      const mockApplication = {
        id: 123,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        entryValidated: false,
        entryValidatedAt: null,
        entryValidatedBy: null,
        user: {
          prenom: 'Jean',
          nom: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        teamAssignments: [
          {
            team: {
              id: 1,
              name: 'Accueil',
            },
            isLeader: true,
          },
        ],
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerReturnableItem.findMany.mockResolvedValue([])

      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        success: true,
        found: true,
        type: 'volunteer',
        message: 'Bénévole trouvé : Jean Dupont',
      })

      expect(result.participant.volunteer).toMatchObject({
        id: 123,
        user: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        entryValidated: false,
      })
    })

    it('devrait inclure les informations de validation si le bénévole est validé', async () => {
      const requestBody = {
        qrCode: 'volunteer-123',
      }

      const mockApplication = {
        id: 123,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        entryValidated: true,
        entryValidatedAt: new Date('2024-01-01'),
        entryValidatedBy: 2,
        user: {
          prenom: 'Jean',
          nom: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        teamAssignments: [],
      }

      const mockValidatedByUser = {
        id: 2,
        prenom: 'Marie',
        nom: 'Martin',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.user.findUnique.mockResolvedValue(mockValidatedByUser as any)
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerReturnableItem.findMany.mockResolvedValue([])

      const result = await handler(mockEvent as any)

      expect(result.participant.volunteer).toMatchObject({
        entryValidated: true,
        entryValidatedAt: new Date('2024-01-01'),
        entryValidatedBy: {
          firstName: 'Marie',
          lastName: 'Martin',
        },
      })
    })

    it('devrait inclure les créneaux horaires du bénévole', async () => {
      const requestBody = {
        qrCode: 'volunteer-123',
      }

      const mockApplication = {
        id: 123,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        entryValidated: false,
        entryValidatedAt: null,
        entryValidatedBy: null,
        user: {
          prenom: 'Jean',
          nom: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        teamAssignments: [],
      }

      const mockAssignments = [
        {
          timeSlot: {
            id: 1,
            title: 'Matin - Accueil',
            startDateTime: new Date('2024-01-01T08:00:00'),
            endDateTime: new Date('2024-01-01T12:00:00'),
            team: { name: 'Accueil' },
          },
        },
      ]

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.volunteerAssignment.findMany.mockResolvedValue(mockAssignments as any)
      prismaMock.editionVolunteerReturnableItem.findMany.mockResolvedValue([])

      const result = await handler(mockEvent as any)

      expect(result.participant.volunteer.timeSlots).toHaveLength(1)
      expect(result.participant.volunteer.timeSlots[0]).toMatchObject({
        id: 1,
        title: 'Matin - Accueil',
        team: 'Accueil',
      })
    })

    it('devrait inclure les articles à restituer', async () => {
      const requestBody = {
        qrCode: 'volunteer-123',
      }

      const mockApplication = {
        id: 123,
        userId: 1,
        editionId: 1,
        status: 'ACCEPTED',
        user: {
          prenom: 'Jean',
          nom: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        teamAssignments: [],
      }

      const mockReturnableItems = [
        {
          returnableItem: {
            id: 1,
            name: 'Badge',
          },
        },
        {
          returnableItem: {
            id: 2,
            name: 'T-shirt',
          },
        },
      ]

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication as any)
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerReturnableItem.findMany.mockResolvedValue(
        mockReturnableItems as any
      )

      const result = await handler(mockEvent as any)

      expect(result.participant.volunteer.returnableItems).toHaveLength(2)
      expect(result.participant.volunteer.returnableItems).toEqual([
        { id: 1, name: 'Badge' },
        { id: 2, name: 'T-shirt' },
      ])
    })

    it('devrait retourner found: false si bénévole non trouvé', async () => {
      const requestBody = {
        qrCode: 'volunteer-999',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        found: false,
        message: 'Aucun bénévole accepté trouvé avec ce QR code',
      })
    })

    it('devrait gérer un QR code bénévole invalide', async () => {
      const requestBody = {
        qrCode: 'volunteer-abc',
      }

      global.readBody.mockResolvedValue(requestBody)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        found: false,
        message: 'QR code bénévole invalide',
      })
    })
  })

  describe('Vérification QR code ticket HelloAsso', () => {
    it('devrait trouver un ticket avec QR code valide', async () => {
      const requestBody = {
        qrCode: 'HELLOASSO-123',
      }

      const mockConfig = {
        editionId: 1,
        helloAssoConfig: {
          id: 1,
        },
      }

      const mockOrderItem = {
        id: 1,
        helloAssoItemId: '123',
        name: 'Pass Week-end',
        amount: 5000,
        state: 'Processed',
        qrCode: 'HELLOASSO-123',
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie.martin@example.com',
        customFields: {},
        entryValidated: false,
        entryValidatedAt: null,
        order: {
          helloAssoOrderId: '1000',
          payerFirstName: 'Marie',
          payerLastName: 'Martin',
          payerEmail: 'marie.martin@example.com',
          items: [
            {
              id: 1,
              helloAssoItemId: '123',
              name: 'Pass Week-end',
              type: 'ticket',
              amount: 5000,
              state: 'Processed',
              qrCode: 'HELLOASSO-123',
              firstName: 'Marie',
              lastName: 'Martin',
              email: 'marie.martin@example.com',
              customFields: {},
              entryValidated: false,
              entryValidatedAt: null,
              tier: {
                id: 1,
                name: 'Week-end',
                returnableItems: [],
              },
            },
          ],
        },
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.externalTicketing.findUnique.mockResolvedValue(mockConfig as any)
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(mockOrderItem as any)

      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        success: true,
        found: true,
        type: 'ticket',
        message: 'Billet trouvé pour Marie Martin',
      })

      expect(result.participant.ticket).toMatchObject({
        id: 1,
        name: 'Pass Week-end',
        amount: 5000,
        state: 'Processed',
        user: {
          firstName: 'Marie',
          lastName: 'Martin',
          email: 'marie.martin@example.com',
        },
      })
    })

    it('devrait inclure les articles à restituer du tier', async () => {
      const requestBody = {
        qrCode: 'HELLOASSO-123',
      }

      const mockConfig = {
        editionId: 1,
        helloAssoConfig: { id: 1 },
      }

      const mockOrderItem = {
        id: 1,
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie@example.com',
        order: {
          helloAssoOrderId: '1000',
          payerFirstName: 'Marie',
          payerLastName: 'Martin',
          payerEmail: 'marie@example.com',
          items: [
            {
              id: 1,
              tier: {
                id: 1,
                name: 'VIP',
                returnableItems: [
                  {
                    returnableItem: {
                      id: 1,
                      name: 'Badge VIP',
                    },
                  },
                ],
              },
            },
          ],
        },
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.externalTicketing.findUnique.mockResolvedValue(mockConfig as any)
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(mockOrderItem as any)

      const result = await handler(mockEvent as any)

      expect(result.participant.ticket.order.items[0].tier.returnableItems).toEqual([
        {
          returnableItem: {
            id: 1,
            name: 'Badge VIP',
          },
        },
      ])
    })

    it('devrait retourner found: false si ticket non trouvé', async () => {
      const requestBody = {
        qrCode: 'UNKNOWN-QR',
      }

      const mockConfig = {
        editionId: 1,
        helloAssoConfig: { id: 1 },
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.externalTicketing.findUnique.mockResolvedValue(mockConfig as any)
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        found: false,
        message: 'Aucun billet trouvé avec ce QR code',
      })
    })

    it('devrait rejeter si configuration HelloAsso introuvable', async () => {
      const requestBody = {
        qrCode: 'HELLOASSO-123',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.externalTicketing.findUnique.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Erreur lors de la recherche du billet'
      )
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
        qrCode: 'TEST-123',
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

    it('devrait rejeter si qrCode manquant', async () => {
      const requestBody = {}

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si qrCode est vide', async () => {
      const requestBody = {
        qrCode: '',
      }

      global.readBody.mockResolvedValue(requestBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const requestBody = {
        qrCode: 'volunteer-123',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Erreur lors de la recherche du billet'
      )
    })

    it('devrait logger les erreurs de base de données', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const requestBody = {
        qrCode: 'volunteer-123',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockEvent as any)).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith('Database verify QR code error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('Vérification des permissions par édition', () => {
    it('devrait vérifier les permissions pour la bonne édition', async () => {
      global.getRouterParam.mockReturnValue('42')

      const requestBody = {
        qrCode: 'volunteer-123',
      }

      global.readBody.mockResolvedValue(requestBody)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)

      await handler(mockEvent as any)

      expect(mockCanAccessEditionData).toHaveBeenCalledWith(42, 1, mockEvent)
    })
  })
})
