/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../server/api/conventions/[id]/collaborators.post';
import { prismaMock } from '../../../../__mocks__/prisma';

// Mock des utilitaires de collaborateur
vi.mock('../../../../server/utils/collaborator-management', () => ({
  addConventionCollaborator: vi.fn(),
  findUserByPseudoOrEmail: vi.fn(),
}));

// Mock de @prisma/client pour capturer les nouvelles instances
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => prismaMock),
  };
});

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
// eslint-disable-next-line import/first
import { addConventionCollaborator, findUserByPseudoOrEmail } from '../../../../server/utils/collaborator-management';
const mockAddCollaborator = addConventionCollaborator as ReturnType<typeof vi.fn>;
const mockFindUser = findUserByPseudoOrEmail as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/collaborators POST', () => {
  beforeEach(() => {
    mockAddCollaborator.mockReset();
    mockFindUser.mockReset();
    prismaMock.user.findUnique.mockReset();
    global.readBody = vi.fn();
  });

  it('devrait ajouter un collaborateur par userIdentifier avec succès', async () => {
    const requestBody = {
      userIdentifier: 'newuser@test.com',
      role: 'MODERATOR',
    };

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    };

    const mockCollaborator = {
      id: 1,
      conventionId: 1,
      userId: 2,
      role: 'MODERATOR',
      addedById: 1,
      user: mockUser,
    };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockResolvedValue(mockUser);
    mockAddCollaborator.mockResolvedValue(mockCollaborator);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      collaborator: mockCollaborator,
    });
    expect(mockFindUser).toHaveBeenCalledWith('newuser@test.com');
    expect(mockAddCollaborator).toHaveBeenCalledWith(1, 2, 'MODERATOR', 1);
  });

  it('devrait ajouter un collaborateur par userId avec succès', async () => {
    const requestBody = {
      userId: 2,
      role: 'ADMINISTRATOR',
    };

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
    };

    const mockCollaborator = {
      id: 1,
      conventionId: 1,
      userId: 2,
      role: 'ADMINISTRATOR',
      addedById: 1,
      user: mockUser,
    };

    global.readBody.mockResolvedValue(requestBody);
    // Reset du mock pour s'assurer qu'il retourne la bonne valeur
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    mockAddCollaborator.mockResolvedValue(mockCollaborator);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      collaborator: mockCollaborator,
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true, pseudo: true },
    });
    expect(mockAddCollaborator).toHaveBeenCalledWith(1, 2, 'ADMINISTRATOR', 1);
  });

  it('devrait utiliser le rôle par défaut MODERATOR', async () => {
    const requestBody = {
      userIdentifier: 'newuser@test.com',
    };

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockResolvedValue(mockUser);
    mockAddCollaborator.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockAddCollaborator).toHaveBeenCalledWith(1, 2, 'MODERATOR', 1);
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const requestBody = {
      userIdentifier: 'test@example.com',
      role: 'MODERATOR',
    };

    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter si ni userIdentifier ni userId fourni', async () => {
    const requestBody = {
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait rejeter si utilisateur introuvable par userId', async () => {
    const requestBody = {
      userId: 999,
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Utilisateur introuvable');
  });

  it('devrait rejeter si utilisateur introuvable par userIdentifier', async () => {
    const requestBody = {
      userIdentifier: 'nonexistent@test.com',
      role: 'MODERATOR',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Utilisateur introuvable avec ce pseudo ou cet email');
  });

  it('devrait empêcher l\'utilisateur de s\'ajouter lui-même', async () => {
    const requestBody = {
      userId: 1, // Même ID que l'utilisateur connecté
      role: 'MODERATOR',
    };

    const mockUser = {
      id: 1,
      pseudo: 'admin',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    await expect(handler(mockEvent as any)).rejects.toThrow('Vous ne pouvez pas vous ajouter comme collaborateur');
  });

  it('devrait valider les données avec zod', async () => {
    const invalidBody = {
      userIdentifier: '', // String vide invalide
      role: 'INVALID_ROLE', // Rôle invalide
    };

    global.readBody.mockResolvedValue(invalidBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs de addConventionCollaborator', async () => {
    const requestBody = {
      userIdentifier: 'newuser@test.com',
      role: 'MODERATOR',
    };

    const mockUser = {
      id: 2,
      pseudo: 'newuser',
      email: 'newuser@test.com',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockResolvedValue(mockUser);
    mockAddCollaborator.mockRejectedValue(new Error('Permission denied'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const requestBody = {
      userIdentifier: 'newuser@test.com',
      role: 'MODERATOR',
    };

    const httpError = {
      statusCode: 403,
      statusMessage: 'Permission refusée',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    };

    const requestBody = {
      userIdentifier: 'newuser@test.com',
      role: 'MODERATOR',
    };

    const mockUser = { id: 2, pseudo: 'newuser' };

    global.readBody.mockResolvedValue(requestBody);
    mockFindUser.mockResolvedValue(mockUser);
    mockAddCollaborator.mockResolvedValue({});

    await handler(eventWithStringId as any);

    expect(mockAddCollaborator).toHaveBeenCalledWith(123, 2, 'MODERATOR', 1);
  });
});