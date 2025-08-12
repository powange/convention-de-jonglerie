import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../server/api/conventions/[id].delete';
import { prismaMock } from '../../../__mocks__/prisma';

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

describe('/api/conventions/[id] DELETE', () => {
  beforeEach(() => {
    prismaMock.convention.findUnique.mockReset();
    prismaMock.convention.delete.mockReset();
  });

  it('devrait supprimer une convention en tant qu\'auteur', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 1, // Utilisateur connecté est l'auteur
      collaborators: [],
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);
    prismaMock.convention.delete.mockResolvedValue(mockConvention);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      message: 'Convention supprimée avec succès',
    });
    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        collaborators: {
          where: {
            userId: 1,
            role: 'ADMINISTRATOR',
          },
        },
      },
    });
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('devrait supprimer une convention en tant que collaborateur ADMINISTRATOR', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2, // Utilisateur connecté n'est pas l'auteur
      collaborators: [
        {
          userId: 1,
          role: 'ADMINISTRATOR',
        },
      ],
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);
    prismaMock.convention.delete.mockResolvedValue(mockConvention);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      message: 'Convention supprimée avec succès',
    });
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
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
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    };

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de convention invalide');
  });

  it('devrait rejeter si convention introuvable', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Convention introuvable');
  });

  it('devrait rejeter si utilisateur sans droits', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2, // Utilisateur connecté n'est pas l'auteur
      collaborators: [], // Pas de collaborateurs ADMINISTRATOR
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous n\'avez pas les droits pour supprimer cette convention'
    );
  });

  it('devrait rejeter si collaborateur MODERATOR uniquement', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2,
      collaborators: [], // L'API filtre sur ADMINISTRATOR, donc pas de collaborateurs retournés
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous n\'avez pas les droits pour supprimer cette convention'
    );
  });

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    prismaMock.convention.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur serveur lors de la suppression de la convention'
    );
  });

  it('devrait gérer les erreurs de base de données lors de la suppression', async () => {
    const mockConvention = {
      id: 1,
      authorId: 1,
      collaborators: [],
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);
    prismaMock.convention.delete.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur serveur lors de la suppression de la convention'
    );
  });

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 403,
      message: 'Permission refusée',
    };

    prismaMock.convention.findUnique.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    };

    const mockConvention = {
      id: 123,
      authorId: 1,
      collaborators: [],
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);
    prismaMock.convention.delete.mockResolvedValue(mockConvention);

    await handler(eventWithStringId as any);

    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith({
      where: { id: 123 },
      include: {
        collaborators: {
          where: {
            userId: 1,
            role: 'ADMINISTRATOR',
          },
        },
      },
    });
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 123 },
    });
  });

  it('devrait permettre à un auteur ET collaborateur ADMIN de supprimer', async () => {
    const mockConvention = {
      id: 1,
      authorId: 1, // Utilisateur est l'auteur
      collaborators: [
        {
          userId: 1, // ET aussi collaborateur ADMIN
          role: 'ADMINISTRATOR',
        },
      ],
    };

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention);
    prismaMock.convention.delete.mockResolvedValue(mockConvention);

    const result = await handler(mockEvent as any);

    expect(result.message).toContain('supprimée avec succès');
  });
});