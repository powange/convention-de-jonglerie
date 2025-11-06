import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  addConventionOrganizer: vi.fn(),
  checkAdminMode: vi.fn(),
  findUserByPseudoOrEmail: vi.fn(),
}))

import {
  addConventionOrganizer,
  checkAdminMode,
  findUserByPseudoOrEmail,
} from '@@/server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/collaborators.post'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockAddCollaborator = addConventionOrganizer as ReturnType<typeof vi.fn>
const mockFindUser = findUserByPseudoOrEmail as ReturnType<typeof vi.fn>
const mockCheckAdminMode = checkAdminMode as ReturnType<typeof vi.fn>

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

describe('/api/conventions/[id]/collaborators POST', () => {
  beforeEach(() => {
    mockAddCollaborator.mockReset()
    mockFindUser.mockReset()
    mockCheckAdminMode.mockReset()
    prismaMock.user.findUnique.mockReset()
    global.readBody = vi.fn()

    // Par défaut, l'utilisateur n'est pas en mode admin
    mockCheckAdminMode.mockResolvedValue(false)
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
      canManageOrganizers: false,
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
      canManageOrganizers: true,
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

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter si ni userIdentifier ni userId fourni', async () => {
    const requestBody = {}

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
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

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait gérer les erreurs de addConventionOrganizer', async () => {
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

  it("crée une entrée d'historique CREATED via addConventionOrganizer (vérification indirecte)", async () => {
    const requestBody = { userIdentifier: 'newuser@test.com' }
    const mockUser = { id: 2, pseudo: 'newuser', email: 'newuser@test.com' }
    const mockCollaborator = {
      id: 77,
      conventionId: 1,
      userId: 2,
      canEditConvention: false,
      canDeleteConvention: false,
      canManageOrganizers: false,
      canAddEdition: false,
      canEditAllEditions: false,
      canDeleteAllEditions: false,
      perEditionPermissions: [],
      addedById: 1,
      title: null,
      user: mockUser,
    }
    global.readBody.mockResolvedValue(requestBody)
    mockFindUser.mockResolvedValue(mockUser)
    mockAddCollaborator.mockResolvedValue(mockCollaborator)

    const res = await handler(mockEvent as any)
    expect(res.success).toBe(true)
    // Vérifie que addConventionOrganizer a reçu les champs nécessaires (l'historique est géré là-bas)
    const callArgs = mockAddCollaborator.mock.calls[0][0]
    expect(callArgs.conventionId).toBe(1)
    expect(callArgs.userId).toBe(2)
  })
})
