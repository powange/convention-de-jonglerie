import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import du handler après les mocks
import createConventionHandler from '../../../../../server/api/conventions/index.post'
import { getEmailHash } from '../../../../../server/utils/email-hash'
import { prismaMock } from '../../../../__mocks__/prisma'

describe('API Convention - Création', () => {
  const mockUser = {
    id: 1,
    email: 'creator@example.com',
    pseudo: 'creator',
    nom: 'Creator',
    prenom: 'Test',
  }

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
      email: 'creator@example.com',
    },
  }
  const transformedExpectation = () => ({
    ...rawConvention,
    author: {
      id: rawConvention.author.id,
      pseudo: rawConvention.author.pseudo,
      emailHash: getEmailHash(rawConvention.author.email),
    },
    collaborators: [
      {
        id: 1,
        addedAt: expect.any(Date),
        title: 'Créateur',
        rights: {
          editConvention: true,
          deleteConvention: true,
          manageCollaborators: true,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: true,
        },
        user: {
          id: mockUser.id,
          pseudo: mockUser.pseudo,
          emailHash: getEmailHash(mockUser.email),
        },
        addedBy: { id: mockUser.id, pseudo: mockUser.pseudo },
      },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait créer une nouvelle convention avec succès', async () => {
    prismaMock.convention.create.mockResolvedValue(rawConvention as any)
    prismaMock.conventionCollaborator.create.mockResolvedValue({
      id: 1,
      conventionId: 1,
      userId: 1,
      addedById: 1,
      createdAt: new Date(),
    })
    prismaMock.convention.findUnique.mockResolvedValue({
      ...rawConvention,
      collaborators: [
        {
          id: 1,
          title: 'Créateur',
          addedAt: new Date(),
          canEditConvention: true,
          canDeleteConvention: true,
          canManageCollaborators: true,
          canAddEdition: true,
          canEditAllEditions: true,
          canDeleteAllEditions: true,
          user: { id: mockUser.id, pseudo: mockUser.pseudo, email: mockUser.email },
          addedBy: { id: 1, pseudo: 'creator' },
        },
      ],
    } as any)

    const requestBody = {
      name: 'Convention de Test',
      description: 'Une convention pour les tests',
    }

    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody.mockResolvedValue(requestBody)

    const result = await createConventionHandler(mockEvent)

    expect(result).toEqual(transformedExpectation())
    expect(prismaMock.convention.create).toHaveBeenCalledWith({
      data: {
        name: 'Convention de Test',
        description: 'Une convention pour les tests',
        email: null,
        logo: null,
        authorId: mockUser.id,
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })
    expect(prismaMock.conventionCollaborator.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conventionId: 1,
        userId: mockUser.id,
        addedById: mockUser.id,
        title: 'Créateur',
        canEditConvention: true,
        canDeleteConvention: true,
        canManageCollaborators: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
      }),
    })
  })

  it('devrait rejeter les utilisateurs non authentifiés', async () => {
    const requestBody = {
      name: 'Convention Test',
    }

    const mockEvent = {
      context: { user: null },
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider le nom de convention', async () => {
    const requestBody = {
      name: '', // Nom vide
      description: 'Test',
    }

    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })

  it("devrait sanitiser les données d'entrée", async () => {
    prismaMock.convention.create.mockResolvedValue(rawConvention as any)
    prismaMock.conventionCollaborator.create.mockResolvedValue({
      id: 1,
      conventionId: 1,
      userId: 1,
      role: 'ADMINISTRATOR',
      addedById: 1,
      createdAt: new Date(),
    })
    prismaMock.convention.findUnique.mockResolvedValue({
      ...rawConvention,
      collaborators: [],
    } as any)

    const requestBody = {
      name: '  Convention avec espaces  ',
      description: '  Description avec espaces  ',
      logo: '  ',
    }

    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody.mockResolvedValue(requestBody)

    await createConventionHandler(mockEvent)

    expect(prismaMock.convention.create).toHaveBeenCalled()
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.create.mockRejectedValue(new Error('Database error'))

    const requestBody = {
      name: 'Convention Test',
      description: 'Test',
    }

    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })
})
