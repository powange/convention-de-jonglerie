import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/collaborator-management', () => ({
  updateCollaboratorRights: vi.fn(),
}))

import { updateCollaboratorRights } from '../../../../../server/utils/collaborator-management'
import handler from '../../../../../server/api/conventions/[id]/collaborators/[collaboratorId].put'

const mockUpdateRole = updateCollaboratorRights as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: { id: '1', collaboratorId: '2' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
}

describe('/api/conventions/[id]/collaborators/[collaboratorId] PUT', () => {
  beforeEach(() => {
    mockUpdateRole.mockReset()
    global.readBody = vi.fn()
  })

  it("devrait mettre à jour les droits d'un collaborateur avec succès", async () => {
    const requestBody = { rights: { manageCollaborators: true, editConvention: true } }

    const mockUpdatedCollaborator = {
      id: 2,
      conventionId: 1,
      userId: 3,
      canManageCollaborators: true,
      canEditConvention: true,
      canDeleteConvention: false,
      canAddEdition: false,
      canEditAllEditions: false,
      canDeleteAllEditions: false,
      perEditionPermissions: [],
      addedById: 1,
      user: {
        id: 3,
        pseudo: 'collaborator',
        profilePicture: null,
      },
    }

    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockResolvedValue(mockUpdatedCollaborator)

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.collaborator.rights).toMatchObject({
      manageCollaborators: true,
      editConvention: true,
    })
    expect(mockUpdateRole).toHaveBeenCalled()
  })

  it('devrait mettre à jour un sous-ensemble de droits', async () => {
    const requestBody = { rights: { editConvention: true } }
    const mockUpdatedCollaborator = { id: 2, canEditConvention: true, perEditionPermissions: [] }
    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockResolvedValue(mockUpdatedCollaborator)
    const result = await handler(mockEvent as any)
    expect(result.success).toBe(true)
    expect(mockUpdateRole).toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const requestBody = { rights: { editConvention: true } }

    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid', collaboratorId: '2' } },
    }

    const requestBody = { rights: { editConvention: true } }

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de convention invalide')
  })

  it('devrait rejeter un ID de collaborateur invalide', async () => {
    const eventWithBadCollaboratorId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '1', collaboratorId: 'invalid' } },
    }

    const requestBody = { rights: { editConvention: true } }

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(eventWithBadCollaboratorId as any)).rejects.toThrow(
      'ID de collaborateur invalide'
    )
  })

  it('devrait valider le schéma de droits avec zod', async () => {
    const invalidBody = { rights: { editConvention: 'yes' as any } }

    global.readBody.mockResolvedValue(invalidBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si aucune donnée à mettre à jour n'est fournie", async () => {
    const emptyBody = {}
    global.readBody.mockResolvedValue(emptyBody)
    await expect(handler(mockEvent as any)).rejects.toThrow('Aucune donnée à mettre à jour')
  })

  it('devrait gérer les erreurs de updateCollaboratorRole', async () => {
    const requestBody = { rights: { manageCollaborators: true } }

    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockRejectedValue(new Error('Permission denied'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const requestBody = { rights: { manageCollaborators: true } }

    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait traiter correctement les IDs numériques', async () => {
    const eventWithStringIds = {
      ...mockEvent,
      context: {
        ...mockEvent.context,
        params: { id: '123', collaboratorId: '456' },
      },
    }

    const requestBody = { rights: { editConvention: true } }

    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockResolvedValue({})

    await handler(eventWithStringIds as any)

    expect(mockUpdateRole).toHaveBeenCalledWith(
      expect.objectContaining({
        conventionId: 123,
        collaboratorId: 456,
        userId: 1,
        rights: { editConvention: true },
      })
    )
  })

  it('devrait mettre à jour partiellement les droits', async () => {
    const requestBody = { rights: { addEdition: true } }
    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockResolvedValue({ id: 2, canAddEdition: true })
    const result = await handler(mockEvent as any)
    expect(result.success).toBe(true)
    expect(mockUpdateRole).toHaveBeenCalled()
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = { rights: { manageCollaborators: true } }
    global.readBody.mockResolvedValue(requestBody)
    mockUpdateRole.mockRejectedValue(new Error('Database connection failed'))
    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })
})
