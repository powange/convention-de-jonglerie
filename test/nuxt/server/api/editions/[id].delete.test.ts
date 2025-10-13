import { describe, it, expect, vi, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../../server/api/editions/[id]/index.delete'

describe('/api/editions/[id] DELETE', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  const mockEdition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    imageUrl: null,
    creatorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: mockUser,
    convention: {
      id: 1,
      name: 'Convention Test',
      authorId: 1,
      collaborators: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn()
  })

  it('devrait permettre de supprimer une édition', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
    expect(result.message.toLowerCase()).toMatch(/supprim|delet/)
    expect(prismaMock.edition.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {
        user: null,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter pour un ID invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid')

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: 'invalid' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Invalid Edition ID')
  })

  it('devrait rejeter si édition non trouvée', async () => {
    global.getRouterParam.mockReturnValue('999')
    prismaMock.edition.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '999' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Edition not found')
  })

  it("devrait rejeter si l'utilisateur n'est pas autorisé", async () => {
    const otherUserEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(otherUserEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette édition"
    )
  })

  it("devrait permettre au créateur de l'édition de supprimer", async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
    expect(prismaMock.edition.delete).toHaveBeenCalled()
  })

  it("devrait permettre à l'auteur de la convention de supprimer", async () => {
    const conventionAuthorEdition = {
      ...mockEdition,
      creatorId: 2, // Créé par quelqu'un d'autre
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 1, // Mais convention appartient à l'utilisateur
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(conventionAuthorEdition)
    prismaMock.edition.delete.mockResolvedValue(conventionAuthorEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
    expect(prismaMock.edition.delete).toHaveBeenCalled()
  })

  it('devrait permettre à un collaborateur admin de supprimer', async () => {
    const collaboratorEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [
          {
            userId: 1,
            canDeleteConvention: true,
            canDeleteAllEditions: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(collaboratorEdition)
    prismaMock.edition.delete.mockResolvedValue(collaboratorEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
  })

  it('devrait permettre à un collaborateur modérateur de supprimer', async () => {
    const moderatorEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [
          {
            userId: 1,
            canDeleteConvention: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(moderatorEdition)
    prismaMock.edition.delete.mockResolvedValue(moderatorEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
  })

  it('devrait rejeter un collaborateur viewer', async () => {
    const viewerEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [], // Le viewer n'apparaît pas car filtré par la requête (role MODERATOR/ADMINISTRATOR seulement)
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(viewerEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette édition"
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockRejectedValue(new Error('Database error'))

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait vérifier les permissions avant suppression', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await handler(mockEvent as any)

    // Vérifier que findUnique est appelé avant delete pour vérifier les permissions
    expect(prismaMock.edition.findUnique).toHaveBeenCalledBefore(prismaMock.edition.delete as any)

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        collaboratorPermissions: {
          include: {
            collaborator: {
              select: {
                userId: true,
              },
            },
          },
        },
        convention: {
          include: {
            collaborators: {
              where: {
                userId: 1,
                OR: [
                  { canDeleteAllEditions: true },
                  { canDeleteConvention: true },
                  { canEditAllEditions: true },
                ],
              },
            },
          },
        },
      },
    })
  })

  it('devrait retourner un message de succès', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toHaveProperty('message', 'Edition deleted successfully')
  })

  it("devrait permettre à un super admin de supprimer n'importe quelle édition", async () => {
    const superAdminUser = {
      ...mockUser,
      isGlobalAdmin: true,
    }

    const otherUserEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(otherUserEdition)
    prismaMock.edition.delete.mockResolvedValue(otherUserEdition)

    const mockEvent = {
      context: {
        user: superAdminUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.message).toBeDefined()
  })
})
