import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/conventions/my-conventions.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

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
        logo: null,
        description: 'Description test',
        email: 'contact@test.com',
        createdAt: new Date('2024-01-01'),
        authorId: 1,
        _count: { editions: 2 },
        organizers: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      name: 'Ma Convention',
      logo: null,
      description: 'Description test',
      email: 'contact@test.com',
      createdAt: new Date('2024-01-01'),
      authorId: 1,
      _count: { editions: 2 },
      currentUserRights: null,
    })

    expect(prismaMock.convention.findMany).toHaveBeenCalledWith({
      where: {
        isArchived: false,
        OR: [{ authorId: 1 }, { organizers: { some: { userId: 1 } } }],
      },
      select: {
        id: true,
        name: true,
        logo: true,
        description: true,
        email: true,
        createdAt: true,
        authorId: true,
        _count: {
          select: {
            editions: true,
          },
        },
        organizers: {
          where: { userId: 1 },
          select: {
            canEditConvention: true,
            canDeleteConvention: true,
            canManageOrganizers: true,
            canManageVolunteers: true,
            canAddEdition: true,
            canEditAllEditions: true,
            canDeleteAllEditions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  })

  it("devrait retourner currentUserRights quand l'utilisateur est organisateur", async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Collaborative',
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-01-01'),
        authorId: 2,
        _count: { editions: 0 },
        organizers: [
          {
            canEditConvention: true,
            canDeleteConvention: false,
            canManageOrganizers: false,
            canManageVolunteers: true,
            canAddEdition: true,
            canEditAllEditions: false,
            canDeleteAllEditions: false,
          },
        ],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0].currentUserRights).toEqual({
      editConvention: true,
      deleteConvention: false,
      manageOrganizers: false,
      manageVolunteers: true,
      addEdition: true,
      editAllEditions: false,
      deleteAllEditions: false,
    })
  })

  it('devrait retourner currentUserRights null si pas organisateur', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-01-01'),
        authorId: 1,
        _count: { editions: 0 },
        organizers: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result[0].currentUserRights).toBeNull()
  })

  it('devrait ne pas exposer les données brutes des organisateurs', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-01-01'),
        authorId: 1,
        _count: { editions: 0 },
        organizers: [
          {
            canEditConvention: true,
            canDeleteConvention: false,
            canManageOrganizers: false,
            canManageVolunteers: false,
            canAddEdition: false,
            canEditAllEditions: false,
            canDeleteAllEditions: false,
          },
        ],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    // La réponse ne doit pas contenir le tableau organizers brut
    expect(result[0]).not.toHaveProperty('organizers')
    // Mais doit contenir currentUserRights
    expect(result[0]).toHaveProperty('currentUserRights')
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
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-02-01'),
        authorId: 1,
        _count: { editions: 0 },
        organizers: [],
      },
      {
        id: 1,
        name: 'Convention Ancienne',
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-01-01'),
        authorId: 1,
        _count: { editions: 0 },
        organizers: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Convention Récente')
    expect(result[1].name).toBe('Convention Ancienne')
  })

  it("devrait retourner le compteur d'éditions", async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        logo: null,
        description: null,
        email: null,
        createdAt: new Date('2024-01-01'),
        authorId: 1,
        _count: { editions: 5 },
        organizers: [],
      },
    ]

    prismaMock.convention.findMany.mockResolvedValue(mockConventions)

    const result = await handler(mockEvent as any)

    expect(result[0]._count.editions).toBe(5)
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findMany.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })
})
