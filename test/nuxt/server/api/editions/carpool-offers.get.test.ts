import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/editions/[id]/carpool-offers/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('GET /api/editions/[id]/carpool-offers', () => {
  const mockEvent = {
    context: {
      params: {
        id: '1',
      },
      query: {},
      user: undefined,
    },
  }

  beforeEach(() => {
    prismaMock.carpoolOffer.findMany.mockReset()
    global.getQuery = vi.fn().mockReturnValue({})
  })

  it('devrait récupérer les offres de covoiturage avec succès', async () => {
    const mockOffers = [
      {
        id: 1,
        editionId: 1,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        locationCity: 'Paris',
        locationAddress: '123 rue de la Paix',
        availableSeats: 3,
        description: 'Covoiturage vers convention',
        user: {
          id: 1,
          emailHash: 'hash1',
          pseudo: 'testuser',
          profilePicture: null,
          updatedAt: new Date(),
        },
        bookings: [],
        passengers: [
          {
            id: 1,
            addedAt: new Date(),
            user: {
              id: 2,
              emailHash: 'hash2',
              pseudo: 'passenger1',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
        comments: [
          {
            id: 1,
            content: 'Intéressé !',
            createdAt: new Date(),
            user: {
              id: 3,
              emailHash: 'hash3',
              pseudo: 'commenter',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        editionId: 1,
        tripDate: expect.objectContaining({ gte: expect.any(Date) }),
      }),
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        bookings: {
          include: {
            requester: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        passengers: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { addedAt: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    expect(result).toHaveLength(1)
    expect(result[0].user.emailHash).toBe('hash1')
    expect(result[0].user).not.toHaveProperty('email') // Email doit être masqué
    expect(result[0].passengers[0].user.emailHash).toBe('hash2')
    expect(result[0].comments[0].user.emailHash).toBe('hash3')
  })

  it("devrait échouer avec ID d'édition invalide", async () => {
    const eventWithInvalidId = {
      context: {
        params: {
          id: 'invalid',
        },
        query: {},
        user: undefined,
      },
    }

    await expect(handler(eventWithInvalidId)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait échouer sans ID d'édition", async () => {
    const eventWithoutId = {
      context: {
        params: {},
        query: {},
        user: undefined,
      },
    }

    await expect(handler(eventWithoutId)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolOffer.findMany.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait retourner un tableau vide si aucune offre', async () => {
    prismaMock.carpoolOffer.findMany.mockResolvedValue([])

    const result = await handler(mockEvent)

    expect(result).toEqual([])
  })

  it('devrait trier par date de départ croissante', async () => {
    const mockOffers = [
      {
        id: 1,
        tripDate: new Date('2024-06-20T10:00:00Z'),
        user: { id: 1, emailHash: 'hash1', pseudo: 'user1' },
        bookings: [],
        passengers: [],
        comments: [],
      },
      {
        id: 2,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        user: { id: 2, emailHash: 'hash2', pseudo: 'user2' },
        bookings: [],
        passengers: [],
        comments: [],
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    await handler(mockEvent)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { tripDate: 'asc' },
      })
    )
  })

  it('devrait masquer tous les emails et ajouter les hash', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          emailHash: 'driver-hash',
          pseudo: 'driver',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date(),
        },
        bookings: [],
        passengers: [
          {
            id: 1,
            addedAt: new Date(),
            user: {
              id: 2,
              emailHash: 'passenger-hash',
              pseudo: 'passenger',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
        comments: [
          {
            id: 1,
            content: 'Test comment',
            createdAt: new Date(),
            user: {
              id: 3,
              emailHash: 'commenter-hash',
              pseudo: 'commenter',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    // Vérifier que les emails sont masqués et remplacés par des hash
    expect(result[0].user).not.toHaveProperty('email')
    expect(result[0].user.emailHash).toBe('driver-hash')

    expect(result[0].passengers[0].user).not.toHaveProperty('email')
    expect(result[0].passengers[0].user.emailHash).toBe('passenger-hash')

    expect(result[0].comments[0].user).not.toHaveProperty('email')
    expect(result[0].comments[0].user.emailHash).toBe('commenter-hash')
  })

  it('devrait préserver les autres propriétés des utilisateurs', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          emailHash: 'test-hash',
          pseudo: 'testuser',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date('2024-01-01'),
        },
        bookings: [],
        passengers: [],
        comments: [],
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    expect(result[0].user).toEqual({
      id: 1,
      pseudo: 'testuser',
      emailHash: 'test-hash',
      profilePicture: 'avatar.jpg',
      updatedAt: new Date('2024-01-01'),
    })
  })

  it('devrait parser correctement les IDs numériques', async () => {
    const eventWithStringId = {
      context: {
        params: {
          id: '123',
        },
        query: {},
        user: undefined,
      },
    }

    prismaMock.carpoolOffer.findMany.mockResolvedValue([])

    await handler(eventWithStringId)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 123,
          tripDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })
})
