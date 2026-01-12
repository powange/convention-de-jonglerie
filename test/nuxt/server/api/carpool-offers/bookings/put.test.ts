import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../server/api/carpool-offers/[id]/bookings/[bookingId].put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1', bookingId: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1', bookingId: '1' },
  },
}

const mockCarpoolOffer = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  availableSeats: 3,
  user: { id: 1, pseudo: 'testuser' },
  bookings: [
    { id: 1, status: 'ACCEPTED', seats: 1 },
    { id: 2, status: 'PENDING', seats: 2 },
  ],
}

const mockBooking = {
  id: 2,
  carpoolOfferId: 1,
  requesterId: 2,
  seats: 2,
  message: 'Je souhaite participer',
  status: 'PENDING',
  createdAt: new Date(),
}

const mockUpdatedBooking = {
  ...mockBooking,
  status: 'ACCEPTED',
  requester: {
    id: 2,
    pseudo: 'user2',
    prenom: 'John',
    nom: 'Doe',
    profilePicture: null,
    emailHash: 'abc123',
    updatedAt: new Date(),
  },
}

describe('/api/carpool-offers/[id]/bookings/[bookingId] PUT', () => {
  beforeEach(() => {
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolBooking.findUnique.mockReset()
    prismaMock.carpoolBooking.update.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi
      .fn()
      .mockReturnValueOnce('1') // offerId
      .mockReturnValueOnce('2') // bookingId
  })

  describe("Actions ACCEPT/REJECT (propriétaire de l'offre)", () => {
    it('devrait accepter une réservation avec succès', async () => {
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)
      prismaMock.carpoolBooking.update.mockResolvedValue(mockUpdatedBooking)

      const result = await handler(mockEvent as any)

      expect(result.status).toBe('ACCEPTED')
      expect(prismaMock.carpoolBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { status: 'ACCEPTED' },
        })
      )
    })

    it('devrait rejeter une réservation avec succès', async () => {
      global.readBody.mockResolvedValue({ action: 'REJECT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)
      prismaMock.carpoolBooking.update.mockResolvedValue({
        ...mockUpdatedBooking,
        status: 'REJECTED',
      })

      const result = await handler(mockEvent as any)

      expect(result.status).toBe('REJECTED')
      expect(prismaMock.carpoolBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REJECTED' },
        })
      )
    })

    it('devrait rejeter ACCEPT si pas assez de places disponibles', async () => {
      const offerFullyBooked = {
        ...mockCarpoolOffer,
        availableSeats: 2,
        bookings: [{ id: 1, status: 'ACCEPTED', seats: 2 }],
      }

      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(offerFullyBooked)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)

      await expect(handler(mockEvent as any)).rejects.toThrow('Plus assez de places disponibles')
    })

    it("devrait rejeter si l'utilisateur n'est pas le propriétaire de l'offre", async () => {
      const eventOtherUser = {
        context: {
          params: { id: '1', bookingId: '2' },
          user: { id: 999, email: 'other@example.com', pseudo: 'other', isGlobalAdmin: false },
        },
      }

      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)

      await expect(handler(eventOtherUser as any)).rejects.toThrow('Action non autorisée')
    })
  })

  describe('Action CANCEL (demandeur de la réservation)', () => {
    it("devrait permettre au demandeur d'annuler sa réservation", async () => {
      const eventRequester = {
        context: {
          params: { id: '1', bookingId: '2' },
          user: {
            id: 2,
            email: 'requester@example.com',
            pseudo: 'requester',
            isGlobalAdmin: false,
          },
        },
      }

      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'CANCEL' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)
      prismaMock.carpoolBooking.update.mockResolvedValue({
        ...mockUpdatedBooking,
        status: 'CANCELLED',
      })

      const result = await handler(eventRequester as any)

      expect(result.status).toBe('CANCELLED')
    })

    it("devrait rejeter CANCEL si l'utilisateur n'est pas le demandeur", async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'CANCEL' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(mockBooking)

      await expect(handler(mockEvent as any)).rejects.toThrow('Annulation non autorisée')
    })
  })

  describe('Validations', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
    })

    it("devrait rejeter un ID d'offre invalide", async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('invalid').mockReturnValueOnce('1')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
    })

    it('devrait rejeter un ID de demande invalide', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('invalid')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de demande invalide')
    })

    it('devrait rejeter si action manquante', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({})

      await expect(handler(mockEvent as any)).rejects.toThrow('Action manquante')
    })

    it('devrait rejeter si offre non trouvée', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow('Offre introuvable')
    })

    it('devrait rejeter si réservation non trouvée', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow('Réservation introuvable')
    })

    it("devrait rejeter si la réservation n'appartient pas à l'offre", async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue({
        ...mockBooking,
        carpoolOfferId: 999, // Différent de l'offre
      })

      await expect(handler(mockEvent as any)).rejects.toThrow('Réservation introuvable')
    })

    it('devrait rejeter si réservation déjà traitée (ACCEPT sur ACCEPTED)', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'ACCEPTED',
      })

      await expect(handler(mockEvent as any)).rejects.toThrow('Réservation déjà traitée')
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('DB Error'))

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })

    it('devrait relancer les erreurs HTTP', async () => {
      const httpError = {
        statusCode: 403,
        statusMessage: 'Access denied',
      }

      global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('2')
      global.readBody.mockResolvedValue({ action: 'ACCEPT' })
      prismaMock.carpoolOffer.findUnique.mockRejectedValue(httpError)

      await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
    })
  })
})
