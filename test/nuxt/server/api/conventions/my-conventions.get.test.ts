import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/conventions/my-conventions.get'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockEvent = {
  context: {
    user: {
      id: 1,
      email: 'user@test.com',
      pseudo: 'testuser',
    },
  },
}

describe('/api/conventions/my-conventions GET', () => {
  beforeEach(() => {
    prismaMock.convention.findMany.mockReset()
  })

  it("devrait retourner les conventions de l'utilisateur en tant qu'auteur", async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Ma Convention',
        description: 'Description test',
        authorId: 1,
        createdAt: new Date('2024-01-01'),
        author: {
          id: 1,
          pseudo: 'testuser',
          emailHash: '1dfd40837dd640c912035ed9a7e88a69', // MD5 de 'user@test.com'
        },
        organizers: [],
        editions: [
          {
            id: 1,
            name: 'Edition 2024',
            startDate: new Date('2024-07-01'),
            endDate: new Date('2024-07-03'),
            city: 'Paris',
            country: 'France',
            imageUrl: 'image.jpg',
            isOnline: false,
          },
        ],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      name: 'Ma Convention',
      description: 'Description test',
      authorId: 1,
      createdAt: new Date('2024-01-01'),
      author: {
        id: 1,
        pseudo: 'testuser',
        emailHash: '1dfd40837dd640c912035ed9a7e88a69',
      },
      organizers: [],
      editions: [
        {
          id: 1,
          name: 'Edition 2024',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-03'),
          city: 'Paris',
          country: 'France',
          imageUrl: 'image.jpg',
          isOnline: false,
        },
      ],
    })

    expect(prismaMock.convention.findMany).toHaveBeenCalledWith({
      where: {
        isArchived: false,
        OR: [{ authorId: 1 }, { organizers: { some: { userId: 1 } } }],
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
          },
        },
        organizers: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                emailHash: true,
              },
            },
            perEditionPermissions: true,
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
        editions: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
            isOnline: true,
            _count: {
              select: {
                volunteerApplications: true,
              },
            },
            orders: {
              select: {
                _count: {
                  select: {
                    items: true,
                  },
                },
              },
            },
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  })

  it("devrait retourner les conventions où l'utilisateur est organisateur", async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Collaborative',
        authorId: 2,
        author: {
          id: 2,
          pseudo: 'author',
          emailHash: 'b48e38706543a1d0134a7766d0c135e9', // MD5 de 'author@test.com'
        },
        organizers: [
          {
            id: 1,
            userId: 1,
            canAddEdition: true,
            addedAt: new Date('2024-01-02'),
            user: {
              id: 1,
              pseudo: 'testuser',
              profilePicture: null,
              emailHash: '1dfd40837dd640c912035ed9a7e88a69', // MD5 de 'user@test.com'
            },
          },
        ],
        editions: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0].organizers).toHaveLength(1)
    expect(result[0].organizers[0].user.emailHash).toBe('1dfd40837dd640c912035ed9a7e88a69')
    expect(result[0].author.emailHash).toBe('b48e38706543a1d0134a7766d0c135e9')
  })

  it('devrait masquer tous les emails avec emailHash', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        authorId: 1,
        author: {
          id: 1,
          pseudo: 'author',
          emailHash: 'b48e38706543a1d0134a7766d0c135e9', // MD5 de 'author@test.com'
        },
        organizers: [
          {
            id: 1,
            user: {
              id: 2,
              pseudo: 'collab1',
              emailHash: '90a5b84c8c548e1aec4ea8e77ad8395a', // MD5 de 'collab1@test.com'
              profilePicture: 'avatar1.jpg',
            },
          },
          {
            id: 2,
            user: {
              id: 3,
              pseudo: 'collab2',
              emailHash: 'b1d8db4e46ad1bfef09f6b341f8c0f78', // MD5 de 'collab2@test.com'
              profilePicture: null,
            },
          },
        ],
        editions: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result[0].author.emailHash).toBe('b48e38706543a1d0134a7766d0c135e9')
    expect(result[0].organizers[0].user.emailHash).toBe('90a5b84c8c548e1aec4ea8e77ad8395a')
    expect(result[0].organizers[1].user.emailHash).toBe('b1d8db4e46ad1bfef09f6b341f8c0f78')

    // Vérifier que les emails originaux ne sont pas exposés
    expect(result[0].author).not.toHaveProperty('email')
    expect(result[0].organizers[0].user).not.toHaveProperty('email')
    expect(result[0].organizers[1].user).not.toHaveProperty('email')
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      context: { user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait retourner un tableau vide si aucune convention', async () => {
    prismaMock.convention.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
  })

  it('devrait ordonner les conventions par date de création décroissante', async () => {
    const mockConventions = [
      {
        id: 2,
        name: 'Convention Récente',
        createdAt: new Date('2024-02-01'),
        author: { id: 1, pseudo: 'user', emailHash: '1dfd40837dd640c912035ed9a7e88a69' },
        organizers: [],
        editions: [],
      },
      {
        id: 1,
        name: 'Convention Ancienne',
        createdAt: new Date('2024-01-01'),
        author: { id: 1, pseudo: 'user', emailHash: '1dfd40837dd640c912035ed9a7e88a69' },
        organizers: [],
        editions: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Convention Récente')
    expect(result[1].name).toBe('Convention Ancienne')
  })

  it('devrait ordonner les éditions par date de début croissante', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', emailHash: '1dfd40837dd640c912035ed9a7e88a69' },
        organizers: [],
        editions: [
          {
            id: 2,
            name: 'Edition 2025',
            startDate: new Date('2025-07-01'),
          },
          {
            id: 1,
            name: 'Edition 2024',
            startDate: new Date('2024-07-01'),
          },
        ],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result[0].editions).toHaveLength(2)
    expect(result[0].editions[0].name).toBe('Edition 2025')
    expect(result[0].editions[1].name).toBe('Edition 2024')
  })

  it("devrait ordonner les organisateurs par date d'ajout croissante", async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', emailHash: '1dfd40837dd640c912035ed9a7e88a69' },
        organizers: [
          {
            id: 2,
            addedAt: new Date('2024-01-02'),
            user: { id: 3, pseudo: 'collab2', emailHash: 'b1d8db4e46ad1bfef09f6b341f8c0f78' },
          },
          {
            id: 1,
            addedAt: new Date('2024-01-01'),
            user: { id: 2, pseudo: 'collab1', emailHash: '90a5b84c8c548e1aec4ea8e77ad8395a' },
          },
        ],
        editions: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    await handler(mockEvent as any)

    expect(prismaMock.convention.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          organizers: expect.objectContaining({
            orderBy: { addedAt: 'asc' },
          }),
        }),
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findMany.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les organisateurs sans profilePicture', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', emailHash: '1dfd40837dd640c912035ed9a7e88a69' },
        organizers: [
          {
            id: 1,
            user: {
              id: 2,
              pseudo: 'collab',
              emailHash: '90a5b84c8c548e1aec4ea8e77ad8395a', // MD5 de 'collab@test.com'
              profilePicture: null,
            },
          },
        ],
        editions: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result[0].organizers[0].user.profilePicture).toBeNull()
  })
})
