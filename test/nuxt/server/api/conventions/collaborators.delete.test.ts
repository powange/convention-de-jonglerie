import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  deleteConventionOrganizer: vi.fn(),
}))

import { deleteConventionOrganizer } from '@@/server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/collaborators/[organizerId].delete'

const mockDeleteCollaborator = deleteConventionOrganizer as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: { id: '1', organizerId: '2' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
}

describe('/api/conventions/[id]/collaborators/[organizerId] DELETE', () => {
  beforeEach(() => {
    mockDeleteCollaborator.mockReset()
  })

  it('devrait supprimer un collaborateur avec succès', async () => {
    const mockResult = {
      success: true,
      message: 'Collaborateur supprimé avec succès',
    }

    mockDeleteCollaborator.mockResolvedValue(mockResult)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      message: 'Collaborateur supprimé avec succès',
    })
    expect(mockDeleteCollaborator).toHaveBeenCalledWith(1, 2, 1, expect.anything())
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid', organizerId: '2' } },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de convention invalide')
  })

  it('devrait rejeter un ID d\'organisateur invalide', async () => {
    const eventWithBadOrganizerId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '1', organizerId: 'invalid' } },
    }

    await expect(handler(eventWithBadOrganizerId as any)).rejects.toThrow(
      'ID d\'organisateur invalide'
    )
  })

  it('devrait gérer les erreurs de deleteConventionOrganizer', async () => {
    mockDeleteCollaborator.mockRejectedValue(new Error('Permission denied'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    }

    mockDeleteCollaborator.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait traiter correctement les IDs numériques', async () => {
    const eventWithStringIds = {
      ...mockEvent,
      context: {
        ...mockEvent.context,
        params: { id: '123', organizerId: '456' },
      },
    }

    const mockResult = {
      success: true,
      message: 'Collaborateur supprimé',
    }

    mockDeleteCollaborator.mockResolvedValue(mockResult)

    await handler(eventWithStringIds as any)

    expect(mockDeleteCollaborator).toHaveBeenCalledWith(123, 456, 1, expect.anything())
  })

  it("devrait retourner le message d'erreur spécifique", async () => {
    const mockResult = {
      success: false,
      message: 'Impossible de supprimer le dernier administrateur',
    }

    mockDeleteCollaborator.mockResolvedValue(mockResult)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      success: false,
      message: 'Impossible de supprimer le dernier administrateur',
    })
  })

  it('devrait gérer les erreurs de collaborateur introuvable', async () => {
    const httpError = {
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable',
    }

    mockDeleteCollaborator.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait gérer les erreurs de permissions insuffisantes', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Permissions insuffisantes pour supprimer ce collaborateur',
    }

    mockDeleteCollaborator.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait gérer les erreurs de base de données', async () => {
    mockDeleteCollaborator.mockRejectedValue(new Error('Database connection failed'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it("devrait gérer le cas où l'utilisateur tente de se supprimer lui-même", async () => {
    const mockResult = {
      success: false,
      message: 'Vous ne pouvez pas vous supprimer vous-même',
    }

    mockDeleteCollaborator.mockResolvedValue(mockResult)

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(false)
    expect(result.message).toContain('vous supprimer vous-même')
  })

  it("déclenche une entrée d'historique REMOVED (appel utilitaire simulé)", async () => {
    // On simule simplement le retour puisque la création d'historique est interne à deleteConventionOrganizer
    mockDeleteCollaborator.mockResolvedValue({ success: true, message: 'ok' })
    const res = await handler(mockEvent as any)
    expect(res.success).toBe(true)
    // Vérifie paramétrage pour que l'utilitaire puisse créer l'historique avec targetUserId = user du collaborateur supprimé
    expect(mockDeleteCollaborator).toHaveBeenCalledWith(1, 2, 1, expect.anything())
  })
})
