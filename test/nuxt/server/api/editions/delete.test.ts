import { describe, it, expect, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../../server/api/editions/[id]/index.delete'

const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
}

describe('/api/editions/[id] DELETE', () => {
  beforeEach(() => {
    prismaMock.edition.findUnique.mockReset()
    prismaMock.edition.delete.mockReset()
  })

  it('devrait supprimer une édition en tant que créateur', async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 1, // Utilisateur connecté est le créateur
      convention: {
        id: 1,
        authorId: 2,
        collaborators: [],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Edition deleted successfully',
    })
    expect(prismaMock.edition.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it("devrait supprimer une édition en tant qu'auteur de la convention", async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 2, // Utilisateur connecté n'est pas le créateur
      convention: {
        id: 1,
        authorId: 1, // Mais il est l'auteur de la convention
        collaborators: [],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Edition deleted successfully',
    })
  })

  it('devrait supprimer une édition en tant que collaborateur MODERATOR', async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 2,
      convention: {
        id: 1,
        authorId: 3,
        collaborators: [
          {
            userId: 1,
            canDeleteAllEditions: true,
            canEditAllEditions: true,
          },
        ],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Edition deleted successfully',
    })
  })

  it('devrait supprimer une édition en tant que collaborateur ADMINISTRATOR', async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 2,
      convention: {
        id: 1,
        authorId: 3,
        collaborators: [
          {
            userId: 1,
            role: 'ADMINISTRATOR',
          },
        ],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue({
      ...mockEdition,
      convention: {
        ...mockEdition.convention,
        collaborators: [{ userId: 1, canDeleteConvention: true }],
      },
    })
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Edition deleted successfully',
    })
  })

  it("devrait supprimer une édition en tant qu'admin global", async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 2,
      convention: {
        id: 1,
        authorId: 3,
        collaborators: [],
      },
    }

    const eventWithGlobalAdmin = {
      ...mockEvent,
      context: {
        ...mockEvent.context,
        user: {
          ...mockEvent.context.user,
          isGlobalAdmin: true,
        },
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    const result = await handler(eventWithGlobalAdmin as any)

    expect(result).toEqual({
      message: 'Edition deleted successfully',
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it("devrait rejeter un ID d'édition invalide", async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Invalid Edition ID')
  })

  it('devrait rejeter si édition introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Edition not found')
  })

  it('devrait rejeter si utilisateur sans droits', async () => {
    const mockEdition = {
      id: 1,
      name: 'Edition Test',
      creatorId: 2, // Utilisateur connecté n'est pas le créateur
      convention: {
        id: 1,
        authorId: 3, // Ni l'auteur de la convention
        collaborators: [], // Ni un collaborateur
      },
    }

    const eventWithoutGlobalAdmin = {
      ...mockEvent,
      context: {
        ...mockEvent.context,
        user: {
          ...mockEvent.context.user,
          isGlobalAdmin: false,
        },
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

    await expect(handler(eventWithoutGlobalAdmin as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette édition"
    )
  })

  it('devrait rejeter si collaborateur VIEWER uniquement', async () => {
    const mockEdition = {
      id: 1,
      creatorId: 2,
      convention: {
        id: 1,
        authorId: 3,
        collaborators: [], // VIEWER ne correspond pas aux critères de la requête (MODERATOR/ADMINISTRATOR seulement)
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette édition"
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.edition.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Internal Server Error')
  })

  it('devrait gérer les erreurs de suppression', async () => {
    const mockEdition = {
      id: 1,
      creatorId: 1,
      convention: {
        id: 1,
        authorId: 1,
        collaborators: [],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockRejectedValue(new Error('Delete failed'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Internal Server Error')
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    }

    const mockEdition = {
      id: 123,
      creatorId: 1,
      convention: {
        id: 1,
        authorId: 1,
        collaborators: [],
      },
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.delete.mockResolvedValue(mockEdition)

    await handler(eventWithStringId as any)

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 123 },
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
    expect(prismaMock.edition.delete).toHaveBeenCalledWith({
      where: { id: 123 },
    })
  })

  it('devrait vérifier toutes les conditions de permission', async () => {
    // Test avec tous les cas de permission possibles
    const testCases = [
      {
        name: 'créateur',
        edition: { creatorId: 1, convention: { authorId: 2, collaborators: [] } },
        user: { id: 1, isGlobalAdmin: false },
        shouldPass: true,
      },
      {
        name: 'auteur convention',
        edition: { creatorId: 2, convention: { authorId: 1, collaborators: [] } },
        user: { id: 1, isGlobalAdmin: false },
        shouldPass: true,
      },
      {
        name: 'collaborateur ADMIN',
        edition: {
          creatorId: 2,
          convention: { authorId: 3, collaborators: [{ userId: 1, canDeleteConvention: true }] },
        },
        user: { id: 1, isGlobalAdmin: false },
        shouldPass: true,
      },
      {
        name: 'admin global',
        edition: { creatorId: 2, convention: { authorId: 3, collaborators: [] } },
        user: { id: 1, isGlobalAdmin: true },
        shouldPass: true,
      },
      {
        name: 'aucun droit',
        edition: { creatorId: 2, convention: { authorId: 3, collaborators: [] } },
        user: { id: 1, isGlobalAdmin: false },
        shouldPass: false,
      },
    ]

    for (const testCase of testCases) {
      const event = {
        context: {
          params: { id: '1' },
          user: testCase.user,
        },
      }

      prismaMock.edition.findUnique.mockResolvedValue({
        id: 1,
        ...testCase.edition,
      })

      if (testCase.shouldPass) {
        prismaMock.edition.delete.mockResolvedValue({})
        const result = await handler(event as any)
        expect(result.message).toContain('deleted successfully')
      } else {
        await expect(handler(event as any)).rejects.toThrow(
          "Vous n'avez pas les droits pour supprimer cette édition"
        )
      }
    }
  })
})
