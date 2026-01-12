import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/carpool-offers/[id]/bookings.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1' },
  },
}

const mockCarpoolOffer = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  availableSeats: 3,
}

const mockBookings = [
  {
    id: 1,
    carpoolOfferId: 1,
    requestId: null,
    requesterId: 2,
    seats: 2,
    message: 'Je souhaite participer',
    status: 'PENDING',
    createdAt: new Date('2024-01-01'),
    requester: {
      id: 2,
      pseudo: 'user2',
      emailHash: 'abc123',
      profilePicture: null,
      updatedAt: new Date(),
    },
  },
  {
    id: 2,
    carpoolOfferId: 1,
    requestId: null,
    requesterId: 3,
    seats: 1,
    message: null,
    status: 'ACCEPTED',
    createdAt: new Date('2024-01-02'),
    requester: {
      id: 3,
      pseudo: 'user3',
      emailHash: 'def456',
      profilePicture: '/uploads/avatar.jpg',
      updatedAt: new Date(),
    },
  },
]

describe('/api/carpool-offers/[id]/bookings GET', () => {
  beforeEach(() => {
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolBooking.findMany.mockReset()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it("devrait retourner toutes les réservations pour le propriétaire de l'offre", async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolBooking.findMany.mockResolvedValue(mockBookings)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('requester')
    expect(result[0].requester).toHaveProperty('pseudo')
    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { carpoolOfferId: 1 },
      })
    )
  })

  it('devrait retourner uniquement ses propres réservations pour un non-propriétaire', async () => {
    const eventOtherUser = {
      context: {
        params: { id: '1' },
        user: { id: 2, email: 'other@example.com', pseudo: 'otheruser', isGlobalAdmin: false },
      },
    }

    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolBooking.findMany.mockResolvedValue([mockBookings[0]])

    const result = await handler(eventOtherUser as any)

    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { carpoolOfferId: 1, requesterId: 2 },
      })
    )
  })

  it('devrait retourner un tableau vide pour un utilisateur non connecté', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolBooking.findMany.mockResolvedValue([])

    const result = await handler(mockEventWithoutUser as any)

    // Pour un utilisateur non connecté, on filtre sur carpoolOfferId: -1 (aucun résultat)
    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { carpoolOfferId: -1 },
      })
    )
  })

  it("devrait rejeter un ID d'offre invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValue('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
  })

  it("devrait rejeter un ID d'offre égal à 0", async () => {
    global.getRouterParam = vi.fn().mockReturnValue('0')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
  })

  it('devrait rejeter si offre non trouvée', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Offre de covoiturage introuvable')
  })

  it('devrait formater les réservations avec les informations du demandeur', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolBooking.findMany.mockResolvedValue(mockBookings)

    const result = await handler(mockEvent as any)

    expect(result[0]).toEqual({
      id: 1,
      carpoolOfferId: 1,
      requestId: null,
      seats: 2,
      message: 'Je souhaite participer',
      status: 'PENDING',
      createdAt: expect.any(Date),
      requester: {
        id: 2,
        pseudo: 'user2',
        emailHash: 'abc123',
        profilePicture: null,
        updatedAt: expect.any(Date),
      },
    })
  })

  it('devrait trier les réservations par date de création décroissante', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolBooking.findMany.mockResolvedValue(mockBookings)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    prismaMock.carpoolOffer.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
