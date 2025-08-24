import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/conventions/[id]/collaborators.post'
import {
  addConventionCollaborator,
  findUserByPseudoOrEmail,
} from '../../../../../server/utils/collaborator-management'
import { prismaMock } from '../../../../__mocks__/prisma'

// Mock des utilitaires de collaborateur
vi.mock('../../../../../server/utils/collaborator-management', () => ({
  addConventionCollaborator: vi.fn(),
  findUserByPseudoOrEmail: vi.fn(),
}))

// Mock de @prisma/client pour capturer les nouvelles instances
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => prismaMock),
  }
})

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

// Import des mocks après la déclaration

const mockAddCollaborator = addConventionCollaborator as ReturnType<typeof vi.fn>
const mockFindUser = findUserByPseudoOrEmail as ReturnType<typeof vi.fn>

describe('/api/conventions/[id]/collaborators POST', () => {
  beforeEach(() => {
    mockAddCollaborator.mockReset()
    mockFindUser.mockReset()
    prismaMock.user.findUnique.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait ajouter un collaborateur par userIdentifier avec succès', async () => {
    const requestBody = {
      userIdentifier: 'newuser@test.com',
      rights: { editConvention: true },
    }

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    }

    const mockCollaborator = {
      id: 1,
      conventionId: 1,
      userId: 2,
      canEditConvention: true,
      canDeleteConvention: false,
      canManageCollaborators: false,
      canAddEdition: false,
      canEditAllEditions: false,
      canDeleteAllEditions: false,
      perEditionPermissions: [],
      addedById: 1,
      user: mockUser,
    }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(mockUser)
    mockAddCollaborator.mockResolvedValue(mockCollaborator)

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.collaborator).toMatchObject({
      id: mockCollaborator.id,
      rights: { editConvention: true },
      perEdition: [],
      user: { id: mockUser.id, pseudo: mockUser.pseudo },
    })
    expect(mockFindUser).toHaveBeenCalledWith('newuser@test.com')
    expect(mockAddCollaborator).toHaveBeenCalled()
  })

  it('devrait ajouter un collaborateur par userId avec succès', async () => {
    const requestBody = {
      userId: 2,
      rights: { manageCollaborators: true },
    }

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
    }

    const mockCollaborator = {
      id: 1,
      conventionId: 1,
      userId: 2,
      canManageCollaborators: true,
      canEditConvention: false,
      canDeleteConvention: false,
      canAddEdition: false,
      canEditAllEditions: false,
      canDeleteAllEditions: false,
      perEditionPermissions: [],
      addedById: 1,
      user: mockUser,
    }

    global.readBody.mockResolvedValue(requestBody)
    // Reset du mock pour s'assurer qu'il retourne la bonne valeur
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    mockAddCollaborator.mockResolvedValue(mockCollaborator)

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.collaborator.rights.manageCollaborators).toBe(true)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true, pseudo: true },
    })
    expect(mockAddCollaborator).toHaveBeenCalled()
  })

  it('devrait créer avec droits par défaut à false si pas fournis', async () => {
    const requestBody = { userIdentifier: 'newuser@test.com' }

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(mockUser)
    mockAddCollaborator.mockResolvedValue({})

    await handler(mockEvent as any)

    expect(mockAddCollaborator).toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const requestBody = { userIdentifier: 'test@example.com' }

    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié')
  })

  it('devrait rejeter si ni userIdentifier ni userId fourni', async () => {
    const requestBody = {}

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait rejeter si utilisateur introuvable par userId', async () => {
    const requestBody = { userId: 999 }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Utilisateur introuvable')
  })

  it('devrait rejeter si utilisateur introuvable par userIdentifier', async () => {
    const requestBody = { userIdentifier: 'nonexistent@test.com' }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Utilisateur introuvable avec ce pseudo ou cet email'
    )
  })

  it("devrait empêcher l'utilisateur de s'ajouter lui-même", async () => {
    const requestBody = { userId: 1 }

    const mockUser = {
      id: 1,
      pseudo: 'admin',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous ne pouvez pas vous ajouter comme collaborateur'
    )
  })

  it('devrait valider les données avec zod', async () => {
    const invalidBody = { userIdentifier: '' }

    global.readBody.mockResolvedValue(invalidBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs de addConventionCollaborator', async () => {
    const requestBody = { userIdentifier: 'newuser@test.com' }

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(mockUser)
    mockAddCollaborator.mockRejectedValue(new Error('Permission denied'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const requestBody = { userIdentifier: 'newuser@test.com' }

    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    }

    const requestBody = { userIdentifier: 'newuser@test.com' }

    const mockUser = { id: 2, pseudo: 'newuser' }

    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(mockUser)
    mockAddCollaborator.mockResolvedValue({})

    await handler(eventWithStringId as any)

    // Vérifie que la fonction est appelée avec un objet contenant conventionId et userId correctement parsés
    expect(mockAddCollaborator).toHaveBeenCalledWith(
      expect.objectContaining({
        conventionId: 123,
        userId: 2,
        addedById: 1,
      })
    )
  })
})
