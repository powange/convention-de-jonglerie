import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/editions/[id]/carpool-requests/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1' },
    query: {},
    user: undefined,
  },
}

describe('/api/editions/[id]/carpool-requests GET', () => {
  beforeEach(() => {
    prismaMock.carpoolRequest.findMany.mockReset()
    global.getQuery = vi.fn().mockReturnValue({})
  })

  it('devrait retourner les demandes de covoiturage avec emails masqués', async () => {
    const mockRequests = [
      {
        id: 1,
        editionId: 1,
        userId: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        seatsNeeded: 2,
        description: 'Cherche covoiturage',
        phoneNumber: '0123456789',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 1,
          pseudo: 'passenger1',
          emailHash: 'passenger-hash',
          profilePicture: null,
          updatedAt: new Date('2024-01-01'),
        },
        comments: [
          {
            id: 1,
            carpoolRequestId: 1,
            userId: 2,
            content: 'Je peux te prendre !',
            createdAt: new Date('2024-01-02'),
            user: {
              id: 2,
              pseudo: 'driver1',
              emailHash: 'driver-hash',
              profilePicture: 'avatar.jpg',
              updatedAt: new Date('2024-01-02'),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      editionId: 1,
      userId: 1,
      tripDate: new Date('2024-07-15T08:00:00Z'),
      locationCity: 'Lyon',
      seatsNeeded: 2,
      description: 'Cherche covoiturage',
      phoneNumber: '0123456789',
      createdAt: new Date('2024-01-01'),
      user: {
        id: 1,
        pseudo: 'passenger1',
        emailHash: 'passenger-hash',
        profilePicture: null,
        updatedAt: new Date('2024-01-01'),
      },
      comments: [
        {
          id: 1,
          carpoolRequestId: 1,
          userId: 2,
          content: 'Je peux te prendre !',
          createdAt: new Date('2024-01-02'),
          user: {
            id: 2,
            pseudo: 'driver1',
            emailHash: 'driver-hash',
            profilePicture: 'avatar.jpg',
            updatedAt: new Date('2024-01-02'),
          },
        },
      ],
    })

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
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
  })

  it("devrait rejeter un ID d'édition invalide", async () => {
    const eventWithBadId = {
      context: {
        params: { id: 'invalid' },
        query: {},
        user: undefined,
      },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolRequest.findMany.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it("devrait retourner un tableau vide s'il n'y a pas de demandes", async () => {
    prismaMock.carpoolRequest.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
  })

  it('devrait trier les demandes par date de départ croissante', async () => {
    const mockRequests = [
      {
        id: 2,
        tripDate: new Date('2024-07-16T10:00:00Z'),
        locationCity: 'Marseille',
        user: {
          id: 2,
          pseudo: 'user2',
          emailHash: 'hash2',
          profilePicture: null,
          updatedAt: new Date(),
        },
        comments: [],
      },
      {
        id: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        user: {
          id: 1,
          pseudo: 'user1',
          emailHash: 'hash1',
          profilePicture: null,
          updatedAt: new Date(),
        },
        comments: [],
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
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
      orderBy: { tripDate: 'asc' }, // Vérification du tri
    })
  })

  it('devrait gérer les demandes sans commentaires', async () => {
    const mockRequests = [
      {
        id: 1,
        editionId: 1,
        userId: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        seatsNeeded: 1,
        user: {
          id: 1,
          pseudo: 'passenger1',
          emailHash: 'hash1',
          profilePicture: null,
          updatedAt: new Date(),
        },
        comments: [], // Pas de commentaires
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    const result = await handler(mockEvent as any)

    expect(result[0].comments).toEqual([])
  })

  it('devrait trier les commentaires par date décroissante', async () => {
    const mockRequests = [
      {
        id: 1,
        user: {
          id: 1,
          pseudo: 'user1',
          emailHash: 'hash1',
          profilePicture: null,
          updatedAt: new Date(),
        },
        comments: [
          {
            id: 1,
            createdAt: new Date('2024-01-01'),
            user: {
              id: 2,
              pseudo: 'user2',
              emailHash: 'hash2',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
          {
            id: 2,
            createdAt: new Date('2024-01-02'),
            user: {
              id: 3,
              pseudo: 'user3',
              emailHash: 'hash3',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
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
          orderBy: { createdAt: 'desc' }, // Les commentaires triés par date décroissante
        },
      },
      orderBy: { tripDate: 'asc' },
    })
  })

  it('devrait masquer les emails de tous les utilisateurs (demandes et commentaires)', async () => {
    const mockRequests = [
      {
        id: 1,
        user: {
          id: 1,
          pseudo: 'passenger1',
          emailHash: 'passenger-hash',
          profilePicture: null,
          updatedAt: new Date(),
        },
        comments: [
          {
            id: 1,
            user: {
              id: 2,
              pseudo: 'driver1',
              emailHash: 'driver1-hash',
              profilePicture: 'avatar.jpg',
              updatedAt: new Date(),
            },
          },
          {
            id: 2,
            user: {
              id: 3,
              pseudo: 'driver2',
              emailHash: 'driver2-hash',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    const result = await handler(mockEvent as any)

    expect(result[0].user.emailHash).toBe('passenger-hash')
    expect(result[0].comments[0].user.emailHash).toBe('driver1-hash')
    expect(result[0].comments[1].user.emailHash).toBe('driver2-hash')

    // Vérifier que les emails originaux ne sont pas exposés
    expect(result[0].user).not.toHaveProperty('email')
    expect(result[0].comments[0].user).not.toHaveProperty('email')
    expect(result[0].comments[1].user).not.toHaveProperty('email')
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      context: {
        params: { id: '123' },
        query: {},
        user: undefined,
      },
    }

    prismaMock.carpoolRequest.findMany.mockResolvedValue([])

    await handler(eventWithStringId as any)

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        editionId: 123,
        tripDate: expect.objectContaining({ gte: expect.any(Date) }),
      }), // Converti en nombre
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
  })
})
