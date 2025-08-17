import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../../../__mocks__/prisma';

// Import du handler après les mocks
import createConventionHandler from '../../../../../server/api/conventions/index.post'

describe('API Convention - Création', () => {
  const mockUser = {
    id: 1,
    email: 'creator@example.com',
    pseudo: 'creator',
    nom: 'Creator',
    prenom: 'Test'
  }

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
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait créer une nouvelle convention avec succès', async () => {
    prismaMock.convention.create.mockResolvedValue(mockConvention)
    prismaMock.conventionCollaborator.create.mockResolvedValue({
      id: 1,
      conventionId: 1,
      userId: 1,
      role: 'ADMINISTRATOR',
      addedById: 1,
      createdAt: new Date()
    })
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      collaborators: [{
        id: 1,
        role: 'ADMINISTRATOR',
        user: mockUser,
        addedBy: { id: 1, pseudo: 'creator' }
      }]
    })

    const requestBody = {
      name: 'Convention de Test',
      description: 'Une convention pour les tests'
    }

    const mockEvent = {
      context: { user: mockUser }
    }
    global.readBody.mockResolvedValue(requestBody)

    const result = await createConventionHandler(mockEvent)

    expect(result).toBeDefined()
    expect(result.name).toBe('Convention de Test')
    expect(result.author.id).toBe(mockUser.id)
    expect(prismaMock.convention.create).toHaveBeenCalledWith({
      data: {
        name: 'Convention de Test',
        description: 'Une convention pour les tests',
        logo: null,
        authorId: mockUser.id
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true
          }
        }
      }
    })
    expect(prismaMock.conventionCollaborator.create).toHaveBeenCalledWith({
      data: {
        conventionId: 1,
        userId: mockUser.id,
        role: 'ADMINISTRATOR',
        addedById: mockUser.id
      }
    })
  })

  it('devrait rejeter les utilisateurs non authentifiés', async () => {
    const requestBody = {
      name: 'Convention Test'
    }

    const mockEvent = {
      context: { user: null }
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider le nom de convention', async () => {
    const requestBody = {
      name: '', // Nom vide
      description: 'Test'
    }

    const mockEvent = {
      context: { user: mockUser }
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait sanitiser les données d\'entrée', async () => {
    prismaMock.convention.create.mockResolvedValue(mockConvention)
    prismaMock.conventionCollaborator.create.mockResolvedValue({
      id: 1,
      conventionId: 1,
      userId: 1,
      role: 'ADMINISTRATOR',
      addedById: 1,
      createdAt: new Date()
    })
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      collaborators: []
    })

    const requestBody = {
      name: '  Convention avec espaces  ',
      description: '  Description avec espaces  ',
      logo: '  '
    }

    const mockEvent = {
      context: { user: mockUser }
    }
    global.readBody.mockResolvedValue(requestBody)

    await createConventionHandler(mockEvent)

    expect(prismaMock.convention.create).toHaveBeenCalledWith({
      data: {
        name: 'Convention avec espaces',
        description: 'Description avec espaces',
        logo: null,
        authorId: mockUser.id
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true
          }
        }
      }
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.create.mockRejectedValue(new Error('Database error'))

    const requestBody = {
      name: 'Convention Test',
      description: 'Test'
    }

    const mockEvent = {
      context: { user: mockUser }
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(createConventionHandler(mockEvent)).rejects.toThrow()
  })
})