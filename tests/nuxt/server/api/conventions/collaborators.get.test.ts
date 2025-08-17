import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../server/api/conventions/[id]/collaborators.get';
import { prismaMock } from '../../../../__mocks__/prisma';

// Mock des utilitaires de collaborateur
vi.mock('../../../../server/utils/collaborator-management', () => ({
  checkUserConventionPermission: vi.fn(),
  getConventionCollaborators: vi.fn(),
}));

const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
};

// Import des mocks après la déclaration
import { checkUserConventionPermission, getConventionCollaborators } from '../../../../../server/utils/collaborator-management';
const mockCheckPermission = checkUserConventionPermission as ReturnType<typeof vi.fn>;
const mockGetCollaborators = getConventionCollaborators as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/collaborators GET', () => {
  beforeEach(() => {
    mockCheckPermission.mockReset();
    mockGetCollaborators.mockReset();
  });

  it('devrait retourner les collaborateurs avec succès', async () => {
    const mockCollaborators = [
      {
        id: 1,
        conventionId: 1,
        userId: 1,
        role: 'ADMINISTRATOR',
        addedAt: new Date('2024-01-01'),
        user: {
          id: 1,
          pseudo: 'admin',
          profilePicture: null,
        },
        addedBy: {
          id: 1,
          pseudo: 'creator',
        },
      },
      {
        id: 2,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR',
        addedAt: new Date('2024-01-02'),
        user: {
          id: 2,
          pseudo: 'moderator',
          profilePicture: 'avatar.jpg',
        },
        addedBy: {
          id: 1,
          pseudo: 'creator',
        },
      },
    ];

    mockCheckPermission.mockResolvedValue({
      hasPermission: true,
      userRole: 'ADMINISTRATOR',
      isOwner: true,
      isCollaborator: false,
    });
    mockGetCollaborators.mockResolvedValue(mockCollaborators);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockCollaborators);
    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(mockGetCollaborators).toHaveBeenCalledWith(1);
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    };

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter si utilisateur sans permissions', async () => {
    mockCheckPermission.mockResolvedValue({
      hasPermission: false,
      userRole: undefined,
      isOwner: false,
      isCollaborator: false,
    });

    await expect(handler(mockEvent as any)).rejects.toThrow('Vous n\'avez pas accès à cette convention');
  });

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    };

    // checkUserConventionPermission va lever une erreur pour un ID invalide
    mockCheckPermission.mockRejectedValue(new Error('Convention ID invalide'));

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs de base de données', async () => {
    mockCheckPermission.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait fonctionner pour un collaborateur MODERATOR', async () => {
    const mockCollaborators = [
      {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR',
        user: { id: 2, pseudo: 'moderator' },
      },
    ];

    mockCheckPermission.mockResolvedValue({
      hasPermission: true,
      userRole: 'MODERATOR',
      isOwner: false,
      isCollaborator: true,
    });
    mockGetCollaborators.mockResolvedValue(mockCollaborators);

    const eventAsModerator = {
      ...mockEvent,
      context: { ...mockEvent.context, user: { id: 2, pseudo: 'moderator' } },
    };

    const result = await handler(eventAsModerator as any);

    expect(result).toEqual(mockCollaborators);
    expect(mockCheckPermission).toHaveBeenCalledWith(1, 2);
  });

  it('devrait retourner un tableau vide s\'il n\'y a pas de collaborateurs', async () => {
    mockCheckPermission.mockResolvedValue({
      hasPermission: true,
      userRole: 'ADMINISTRATOR',
      isOwner: true,
      isCollaborator: false,
    });
    mockGetCollaborators.mockResolvedValue([]);

    const result = await handler(mockEvent as any);

    expect(result).toEqual([]);
    expect(mockGetCollaborators).toHaveBeenCalledWith(1);
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    };

    mockCheckPermission.mockResolvedValue({
      hasPermission: true,
      userRole: 'ADMINISTRATOR',
      isOwner: true,
      isCollaborator: false,
    });
    mockGetCollaborators.mockResolvedValue([]);

    await handler(eventWithStringId as any);

    expect(mockCheckPermission).toHaveBeenCalledWith(123, 1);
    expect(mockGetCollaborators).toHaveBeenCalledWith(123);
  });

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 404,
      statusMessage: 'Convention introuvable',
    };

    mockCheckPermission.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });
});