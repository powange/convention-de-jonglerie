import { describe, it, expect, vi, beforeEach } from 'vitest'

import getConventionHandler from '../../../../../server/api/conventions/[id]/index.get'
import { prismaMock } from '../../../../__mocks__/prisma'

// Import du handler après les mocks

describe('API Convention - Récupération', () => {
  // Données brutes renvoyées par Prisma (avant transformation dans le handler)
  const rawConvention = {
    id: 1,
    name: 'Convention de Test',
    description: 'Une convention pour les tests',
    logo: null,
    authorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 1,
      pseudo: 'creator',
      emailHash: 'dadbcd70e3cf287900f80aedef3f987c', // MD5 de 'creator@example.com'
    },
    organizers: [
      {
        id: 1,
        title: 'Admin',
        addedAt: new Date('2025-01-01'),
        canEditConvention: true,
        canDeleteConvention: true,
        canManageOrganizers: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
        user: {
          id: 1,
          pseudo: 'creator',
          profilePicture: null,
        },
      },
    ],
  }

  // Forme attendue après transformation
  const expectedTransformed = () => ({
    id: rawConvention.id,
    name: rawConvention.name,
    description: rawConvention.description,
    logo: rawConvention.logo,
    authorId: rawConvention.authorId,
    createdAt: rawConvention.createdAt,
    updatedAt: rawConvention.updatedAt,
    author: {
      id: rawConvention.author.id,
      pseudo: rawConvention.author.pseudo,
      emailHash: rawConvention.author.emailHash,
    },
    organizers: [
      {
        id: rawConvention.organizers[0].id,
        addedAt: rawConvention.organizers[0].addedAt,
        title: rawConvention.organizers[0].title,
        rights: {
          editConvention: true,
          deleteConvention: true,
          manageOrganizers: true,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: true,
        },
        user: rawConvention.organizers[0].user,
      },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait récupérer une convention existante', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(rawConvention as any)

    const mockEvent = {
      context: {},
      params: { id: '1' },
    }

    // Mock de getRouterParam
    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    const result = await getConventionHandler(mockEvent)

    expect(result).toEqual(expectedTransformed())
    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
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
              },
            },
          },
        },
      },
    })
  })

  it('devrait retourner 404 pour une convention inexistante', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: {},
      params: { id: '999' },
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })

  it("devrait valider l'ID de convention", async () => {
    const mockEvent = {
      context: {},
      params: { id: 'invalid' },
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait être accessible sans authentification', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(rawConvention as any)

    const mockEvent = {
      context: { user: null }, // Pas d'utilisateur connecté
      params: { id: '1' },
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    const result = await getConventionHandler(mockEvent)

    expect(result).toEqual(expectedTransformed())
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findUnique.mockRejectedValue(new Error('Database error'))

    const mockEvent = {
      context: {},
      params: { id: '1' },
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })
})
