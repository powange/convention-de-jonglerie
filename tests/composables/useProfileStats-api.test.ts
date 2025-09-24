import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../__mocks__/prisma'

// Mock du handler API
const mockHandler = async (event: any) => {
  const user = event.context.user

  if (!user) {
    const error = new Error('Non authentifié')
    ;(error as any).statusCode = 401
    throw error
  }

  // Compter les conventions créées par l'utilisateur
  const conventionsCreated = await prismaMock.convention.count({
    where: { authorId: user.id },
  })

  // Compter les éditions mises en favoris par l'utilisateur
  const editionsFavorited = await prismaMock.user.findUnique({
    where: { id: user.id },
    select: {
      _count: {
        select: { favoriteEditions: true },
      },
    },
  })

  // Compter le nombre total de favoris reçus sur toutes les éditions de l'utilisateur
  const editionsWithFavorites = await prismaMock.edition.findMany({
    where: {
      OR: [{ creatorId: user.id }, { convention: { authorId: user.id } }],
    },
    select: {
      _count: {
        select: { favoritedBy: true },
      },
    },
  })

  const totalFavoritesReceived = editionsWithFavorites.reduce(
    (sum, edition) => sum + edition._count.favoritedBy,
    0
  )

  return {
    conventionsCreated,
    editionsFavorited: editionsFavorited?._count.favoriteEditions || 0,
    favoritesReceived: totalFavoritesReceived,
  }
}

describe('/api/profile/stats.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('doit retourner les statistiques du profil utilisateur', async () => {
    const mockUser = { id: 1, email: 'test@example.com', pseudo: 'testuser' }

    // Mock des réponses Prisma
    prismaMock.convention.count.mockResolvedValue(2) // 2 conventions créées

    prismaMock.user.findUnique.mockResolvedValue({
      _count: { favoriteEditions: 3 }, // 3 éditions en favoris
    } as any)

    prismaMock.edition.findMany.mockResolvedValue([
      { _count: { favoritedBy: 5 } }, // Édition 1 : 5 favoris
      { _count: { favoritedBy: 3 } }, // Édition 2 : 3 favoris
    ] as any)

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      conventionsCreated: 2,
      editionsFavorited: 3,
      favoritesReceived: 8, // 5 + 3
    })

    // Vérifier les appels Prisma
    expect(prismaMock.convention.count).toHaveBeenCalledWith({
      where: { authorId: mockUser.id },
    })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      select: {
        _count: {
          select: { favoriteEditions: true },
        },
      },
    })

    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ creatorId: mockUser.id }, { convention: { authorId: mockUser.id } }],
      },
      select: {
        _count: {
          select: { favoritedBy: true },
        },
      },
    })
  })

  it('doit retourner des statistiques vides pour un nouvel utilisateur', async () => {
    const mockUser = { id: 1, email: 'newuser@example.com', pseudo: 'newuser' }

    // Mock des réponses vides
    prismaMock.convention.count.mockResolvedValue(0)
    prismaMock.user.findUnique.mockResolvedValue({
      _count: { favoriteEditions: 0 },
    } as any)
    prismaMock.edition.findMany.mockResolvedValue([])

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      conventionsCreated: 0,
      editionsFavorited: 0,
      favoritesReceived: 0,
    })
  })

  it('doit exiger une authentification', async () => {
    const mockEvent = {
      context: { user: null },
    }

    await expect(mockHandler(mockEvent)).rejects.toThrow('Non authentifié')
  })

  it('doit gérer le cas où user.findUnique retourne null', async () => {
    const mockUser = { id: 1, email: 'test@example.com', pseudo: 'testuser' }

    prismaMock.convention.count.mockResolvedValue(1)
    prismaMock.user.findUnique.mockResolvedValue(null) // Utilisateur non trouvé
    prismaMock.edition.findMany.mockResolvedValue([])

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      conventionsCreated: 1,
      editionsFavorited: 0, // null converti en 0
      favoritesReceived: 0,
    })
  })
})
