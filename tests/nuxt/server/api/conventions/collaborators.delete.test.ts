import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../../server/api/conventions/[id]/collaborators/[collaboratorId].delete';

// Mock des utilitaires de collaborateur
vi.mock('../../../../server/utils/collaborator-management', () => ({
  deleteConventionCollaborator: vi.fn(),
}));

const mockEvent = {
  context: {
    params: { id: '1', collaboratorId: '2' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
};

// Import des mocks après la déclaration
import { deleteConventionCollaborator } from '../../../../../server/utils/collaborator-management';
const mockDeleteCollaborator = deleteConventionCollaborator as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/collaborators/[collaboratorId] DELETE', () => {
  beforeEach(() => {
    mockDeleteCollaborator.mockReset();
  });

  it('devrait supprimer un collaborateur avec succès', async () => {
    const mockResult = {
      success: true,
      message: 'Collaborateur supprimé avec succès',
    };

    mockDeleteCollaborator.mockResolvedValue(mockResult);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      message: 'Collaborateur supprimé avec succès',
    });
    expect(mockDeleteCollaborator).toHaveBeenCalledWith(1, 2, 1);
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    };

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid', collaboratorId: '2' } },
    };

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait rejeter un ID de collaborateur invalide', async () => {
    const eventWithBadCollaboratorId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '1', collaboratorId: 'invalid' } },
    };

    await expect(handler(eventWithBadCollaboratorId as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs de deleteConventionCollaborator', async () => {
    mockDeleteCollaborator.mockRejectedValue(new Error('Permission denied'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    };

    mockDeleteCollaborator.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait traiter correctement les IDs numériques', async () => {
    const eventWithStringIds = {
      ...mockEvent,
      context: {
        ...mockEvent.context,
        params: { id: '123', collaboratorId: '456' },
      },
    };

    const mockResult = {
      success: true,
      message: 'Collaborateur supprimé',
    };

    mockDeleteCollaborator.mockResolvedValue(mockResult);

    await handler(eventWithStringIds as any);

    expect(mockDeleteCollaborator).toHaveBeenCalledWith(123, 456, 1);
  });

  it('devrait retourner le message d\'erreur spécifique', async () => {
    const mockResult = {
      success: false,
      message: 'Impossible de supprimer le dernier administrateur',
    };

    mockDeleteCollaborator.mockResolvedValue(mockResult);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: false,
      message: 'Impossible de supprimer le dernier administrateur',
    });
  });

  it('devrait gérer les erreurs de collaborateur introuvable', async () => {
    const httpError = {
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable',
    };

    mockDeleteCollaborator.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait gérer les erreurs de permissions insuffisantes', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Permissions insuffisantes pour supprimer ce collaborateur',
    };

    mockDeleteCollaborator.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait gérer les erreurs de base de données', async () => {
    mockDeleteCollaborator.mockRejectedValue(new Error('Database connection failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer le cas où l\'utilisateur tente de se supprimer lui-même', async () => {
    const mockResult = {
      success: false,
      message: 'Vous ne pouvez pas vous supprimer vous-même',
    };

    mockDeleteCollaborator.mockResolvedValue(mockResult);

    const result = await handler(mockEvent as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('vous supprimer vous-même');
  });
});