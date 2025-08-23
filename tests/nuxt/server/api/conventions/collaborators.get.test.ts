import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../server/api/conventions/[id]/collaborators.get';
import { prismaMock } from '../../../../__mocks__/prisma';

// Import des mocks après la déclaration
import { checkUserConventionPermission } from '../../../../../server/utils/collaborator-management';

// Mock des utilitaires de collaborateur
vi.mock('../../../../server/utils/collaborator-management', () => ({
  checkUserConventionPermission: vi.fn(),
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
const mockCheckPermission = checkUserConventionPermission as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/collaborators GET', () => {
  beforeEach(() => {
  mockCheckPermission.mockReset();
  prismaMock.conventionCollaborator.findMany.mockReset();
  });

  it('devrait retourner les collaborateurs avec succès', async () => {
    const mockCollaborators = [
      {
        id: 1,
        addedAt: new Date('2024-01-01'),
        title: 'Admin',
        rights: {
          editConvention: true,
          deleteConvention: true,
          manageCollaborators: true,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: true,
        },
        perEdition: [],
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
        addedAt: new Date('2024-01-02'),
        title: 'Mod',
        rights: {
          editConvention: false,
          deleteConvention: false,
          manageCollaborators: false,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: false,
        },
        perEdition: [],
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
    // données brutes renvoyées par Prisma avant mapping
    const raw = mockCollaborators.map(c => ({
      id: c.id,
      addedAt: c.addedAt,
      title: c.title,
      canEditConvention: c.rights.editConvention,
      canDeleteConvention: c.rights.deleteConvention,
      canManageCollaborators: c.rights.manageCollaborators,
      canAddEdition: c.rights.addEdition,
      canEditAllEditions: c.rights.editAllEditions,
      canDeleteAllEditions: c.rights.deleteAllEditions,
      perEditionPermissions: [],
      user: c.user,
      addedBy: c.addedBy,
    }));
    prismaMock.conventionCollaborator.findMany.mockResolvedValue(raw as any);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockCollaborators);
    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(prismaMock.conventionCollaborator.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conventionId: 1 } }));
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
        addedAt: new Date(),
        title: 'Mod',
        rights: {
          editConvention: false,
          deleteConvention: false,
          manageCollaborators: false,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: false,
        },
        perEdition: [],
        user: { id: 2, pseudo: 'moderator' },
        addedBy: { id: 99, pseudo: 'creator' }
      },
    ];

    mockCheckPermission.mockResolvedValue({
      hasPermission: true,
      userRole: 'MODERATOR',
      isOwner: false,
      isCollaborator: true,
    });
    const raw = mockCollaborators.map(c => ({
      id: c.id,
      addedAt: c.addedAt,
      title: c.title,
      canEditConvention: c.rights.editConvention,
      canDeleteConvention: c.rights.deleteConvention,
      canManageCollaborators: c.rights.manageCollaborators,
      canAddEdition: c.rights.addEdition,
      canEditAllEditions: c.rights.editAllEditions,
      canDeleteAllEditions: c.rights.deleteAllEditions,
      perEditionPermissions: [],
      user: c.user,
      addedBy: c.addedBy,
    }));
    prismaMock.conventionCollaborator.findMany.mockResolvedValue(raw as any);

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
  prismaMock.conventionCollaborator.findMany.mockResolvedValue([]);

    const result = await handler(mockEvent as any);

    expect(result).toEqual([]);
  expect(prismaMock.conventionCollaborator.findMany).toHaveBeenCalled();
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
  prismaMock.conventionCollaborator.findMany.mockResolvedValue([]);

    await handler(eventWithStringId as any);

    expect(mockCheckPermission).toHaveBeenCalledWith(123, 1);
  expect(prismaMock.conventionCollaborator.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conventionId: 123 } }));
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