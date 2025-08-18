 
import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../server/api/conventions/[id]/collaborators/[collaboratorId].put';

// Mock des utilitaires de collaborateur
vi.mock('../../../../server/utils/collaborator-management', () => ({
  updateCollaboratorRole: vi.fn(),
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
 
import { updateCollaboratorRole } from '../../../../server/utils/collaborator-management';
const mockUpdateRole = updateCollaboratorRole as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/collaborators/[collaboratorId] PUT', () => {
  beforeEach(() => {
    mockUpdateRole.mockReset();
    global.readBody = vi.fn();
  });

  it('devrait mettre à jour le rôle d\'un collaborateur avec succès', async () => {
    const requestBody = {
      role: 'ADMINISTRATOR',
    };

    const mockUpdatedCollaborator = {
      id: 2,
      conventionId: 1,
      userId: 3,
      role: 'ADMINISTRATOR',
      addedById: 1,
      user: {
        id: 3,
        pseudo: 'collaborator',
        profilePicture: null,
      },
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockResolvedValue(mockUpdatedCollaborator);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      collaborator: mockUpdatedCollaborator,
    });
    expect(mockUpdateRole).toHaveBeenCalledWith(1, 2, 'ADMINISTRATOR', 1);
  });

  it('devrait mettre à jour vers MODERATOR', async () => {
    const requestBody = {
      role: 'MODERATOR',
    };

    const mockUpdatedCollaborator = {
      id: 2,
      role: 'MODERATOR',
      user: { pseudo: 'collaborator' },
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockResolvedValue(mockUpdatedCollaborator);

    const result = await handler(mockEvent as any);

    expect(result.success).toBe(true);
    expect(result.collaborator.role).toBe('MODERATOR');
    expect(mockUpdateRole).toHaveBeenCalledWith(1, 2, 'MODERATOR', 1);
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const requestBody = {
      role: 'MODERATOR',
    };

    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid', collaboratorId: '2' } },
    };

    const requestBody = {
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    // L'updateCollaboratorRole va recevoir NaN comme conventionId et rejeter
    mockUpdateRole.mockRejectedValue(new Error('Database error'));

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait rejeter un ID de collaborateur invalide', async () => {
    const eventWithBadCollaboratorId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '1', collaboratorId: 'invalid' } },
    };

    const requestBody = {
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    // L'updateCollaboratorRole va recevoir NaN comme collaboratorId et rejeter
    mockUpdateRole.mockRejectedValue(new Error('Database error'));

    await expect(handler(eventWithBadCollaboratorId as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait valider le rôle avec zod', async () => {
    const invalidBody = {
      role: 'INVALID_ROLE',
    };

    global.readBody.mockResolvedValue(invalidBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait rejeter si le rôle est manquant', async () => {
    const emptyBody = {};

    global.readBody.mockResolvedValue(emptyBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs de updateCollaboratorRole', async () => {
    const requestBody = {
      role: 'ADMINISTRATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockRejectedValue(new Error('Permission denied'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const requestBody = {
      role: 'ADMINISTRATOR',
    };

    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockRejectedValue(httpError);

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

    const requestBody = {
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockResolvedValue({});

    await handler(eventWithStringIds as any);

    expect(mockUpdateRole).toHaveBeenCalledWith(123, 456, 'MODERATOR', 1);
  });

  it('devrait gérer toutes les valeurs de rôles valides', async () => {
    const validRoles = ['ADMINISTRATOR', 'MODERATOR'];
    
    for (const role of validRoles) {
      const requestBody = { role };
      
      global.readBody.mockResolvedValue(requestBody);
      mockUpdateRole.mockResolvedValue({ role });

      const result = await handler(mockEvent as any);

      expect(result.success).toBe(true);
      expect(mockUpdateRole).toHaveBeenCalledWith(1, 2, role, 1);
    }
  });

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      role: 'ADMINISTRATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockUpdateRole.mockRejectedValue(new Error('Database connection failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });
});