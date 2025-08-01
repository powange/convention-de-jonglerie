import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../../__mocks__/prisma'

// Import du handler après les mocks
import getConventionHandler from '../../../../server/api/conventions/[id].get'

describe('API Convention - Récupération', () => {
  const mockConvention = {
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
      email: 'creator@example.com'
    },
    collaborators: [
      {
        id: 1,
        role: 'ADMINISTRATOR',
        user: {
          id: 1,
          pseudo: 'creator',
          profilePicture: null
        }
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait récupérer une convention existante', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)

    const mockEvent = {
      context: {},
      params: { id: '1' }
    }

    // Mock de getRouterParam
    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    const result = await getConventionHandler(mockEvent)

    expect(result).toEqual(mockConvention)
    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true
          }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true
              }
            }
          }
        }
      }
    })
  })

  it('devrait retourner 404 pour une convention inexistante', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: {},
      params: { id: '999' }
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider l\'ID de convention', async () => {
    const mockEvent = {
      context: {},
      params: { id: 'invalid' }
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait être accessible sans authentification', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)

    const mockEvent = {
      context: { user: null }, // Pas d'utilisateur connecté
      params: { id: '1' }
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    const result = await getConventionHandler(mockEvent)

    expect(result).toEqual(mockConvention)
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findUnique.mockRejectedValue(new Error('Database error'))

    const mockEvent = {
      context: {},
      params: { id: '1' }
    }

    global.getRouterParam = vi.fn((event, param) => event.params?.[param])

    await expect(getConventionHandler(mockEvent)).rejects.toThrow()
  })
})