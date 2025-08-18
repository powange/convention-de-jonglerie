import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../../server/api/conventions/[id]/delete-image.delete';

// Import des mocks après la déclaration
import { deleteConventionImage } from '../../../../../../server/utils/image-deletion';

// Mock des modules externes
vi.mock('../../../../../server/utils/image-deletion', () => ({
  deleteConventionImage: vi.fn(),
}));

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com' },
  },
};

const mockEventWithoutUser = {
  context: {},
};

const mockDeleteConventionImage = deleteConventionImage as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/delete-image DELETE', () => {
  beforeEach(() => {
    mockDeleteConventionImage.mockReset();
    global.getRouterParam = vi.fn();
    
    // Valeurs par défaut pour les mocks
    mockDeleteConventionImage.mockResolvedValue({
      success: true,
      message: 'Image supprimée avec succès',
      entity: {
        id: 1,
        nom: 'Convention Test',
        logo: null,
        authorId: 1,
        author: { id: 1, pseudo: 'testuser', email: 'test@example.com' },
      },
    });
  });

  describe('Authentification', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      global.getRouterParam.mockReturnValue('1');

      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Non authentifié');
    });

    it('devrait accepter si utilisateur authentifié', async () => {
      global.getRouterParam.mockReturnValue('1');

      const result = await handler(mockEvent as any);

      expect(result).toEqual({
        success: true,
        message: 'Image supprimée avec succès',
        convention: expect.objectContaining({
          id: 1,
          nom: 'Convention Test',
          logo: null,
        }),
      });
    });
  });

  describe('Validation des paramètres', () => {
    it('devrait rejeter si ID de convention invalide (non numérique)', async () => {
      global.getRouterParam.mockReturnValue('abc');

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
    });

    it('devrait rejeter si ID de convention est NaN', async () => {
      global.getRouterParam.mockReturnValue('NaN');

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
    });

    it('devrait rejeter si ID de convention est undefined', async () => {
      global.getRouterParam.mockReturnValue(undefined);

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
    });

    it('devrait accepter un ID de convention valide', async () => {
      global.getRouterParam.mockReturnValue('123');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(123, 1);
    });

    it('devrait accepter les IDs négatifs (parseInt les convertit)', async () => {
      global.getRouterParam.mockReturnValue('-1');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(-1, 1);
    });

    it('devrait accepter l\'ID 0 (parseInt("0") = 0, pas NaN)', async () => {
      global.getRouterParam.mockReturnValue('0');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(0, 1);
    });

    it('devrait gérer les grands nombres', async () => {
      global.getRouterParam.mockReturnValue('999999999');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(999999999, 1);
    });
  });

  describe('Sécurité et permissions', () => {
    it('devrait vérifier les permissions via deleteConventionImage', async () => {
      global.getRouterParam.mockReturnValue('1');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(1, 1);
    });

    it('devrait rejeter si convention non trouvée', async () => {
      global.getRouterParam.mockReturnValue('999');

      mockDeleteConventionImage.mockRejectedValue({
        statusCode: 404,
        statusMessage: 'Convention introuvable',
      });

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 404,
        statusMessage: 'Convention introuvable',
      });
    });

    it('devrait rejeter si utilisateur n\'est pas l\'auteur', async () => {
      global.getRouterParam.mockReturnValue('1');

      mockDeleteConventionImage.mockRejectedValue({
        statusCode: 403,
        statusMessage: 'Vous n\'avez pas les droits pour modifier cette convention',
      });

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 403,
        statusMessage: 'Vous n\'avez pas les droits pour modifier cette convention',
      });
    });

    it('devrait rejeter si aucune image à supprimer', async () => {
      global.getRouterParam.mockReturnValue('1');

      mockDeleteConventionImage.mockRejectedValue({
        statusCode: 400,
        statusMessage: 'Aucune image à supprimer',
      });

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 400,
        statusMessage: 'Aucune image à supprimer',
      });
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      global.getRouterParam.mockReturnValue('1');

      mockDeleteConventionImage.mockRejectedValue(new Error('Database error'));

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur lors de la suppression de l\'image');
    });

    it('devrait relancer les erreurs HTTP existantes', async () => {
      global.getRouterParam.mockReturnValue('1');

      const httpError = {
        statusCode: 503,
        statusMessage: 'Service unavailable',
      };

      mockDeleteConventionImage.mockRejectedValue(httpError);

      await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
    });

    it('devrait logger les erreurs en console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      global.getRouterParam.mockReturnValue('1');
      mockDeleteConventionImage.mockRejectedValue(new Error('Erreur inattendue'));

      await expect(handler(mockEvent as any)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Erreur lors de la suppression de l\'image:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('devrait gérer les erreurs de parsing des paramètres', async () => {
      global.getRouterParam.mockImplementation(() => {
        throw new Error('Router param error');
      });

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur lors de la suppression de l\'image');
    });
  });

  describe('Réponse de succès', () => {
    it('devrait retourner la structure de réponse correcte', async () => {
      global.getRouterParam.mockReturnValue('1');

      const result = await handler(mockEvent as any);

      expect(result).toEqual({
        success: true,
        message: 'Image supprimée avec succès',
        convention: expect.objectContaining({
          id: 1,
          nom: 'Convention Test',
          logo: null,
        }),
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('convention');
      expect(result.success).toBe(true);
      expect(typeof result.message).toBe('string');
    });

    it('devrait inclure les relations de l\'entité', async () => {
      global.getRouterParam.mockReturnValue('1');

      const result = await handler(mockEvent as any);

      expect(result.convention).toHaveProperty('author');
      expect(result.convention.author).toEqual({
        id: 1,
        pseudo: 'testuser',
        email: 'test@example.com',
      });
    });

    it('devrait confirmer que le logo est null après suppression', async () => {
      global.getRouterParam.mockReturnValue('1');

      const result = await handler(mockEvent as any);

      expect(result.convention.logo).toBeNull();
    });
  });

  describe('Cas limites', () => {
    it('devrait gérer l\'ID 1', async () => {
      global.getRouterParam.mockReturnValue('1');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(1, 1);
    });

    it('devrait gérer les IDs avec des zéros en début', async () => {
      global.getRouterParam.mockReturnValue('0123');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(123, 1);
    });

    it('devrait gérer les IDs décimaux (truncation)', async () => {
      global.getRouterParam.mockReturnValue('123.456');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(123, 1);
    });

    it('devrait gérer les espaces dans l\'ID', async () => {
      global.getRouterParam.mockReturnValue(' 123 ');

      await handler(mockEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(123, 1);
    });

    it('devrait accepter les chaînes vides (parseInt donne NaN puis rejeté)', async () => {
      global.getRouterParam.mockReturnValue('');

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
    });

    it('devrait rejeter null (parseInt(null) donne NaN)', async () => {
      global.getRouterParam.mockReturnValue(null);

      await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
    });
  });

  describe('Intégration avec utils/image-deletion', () => {
    it('devrait appeler deleteConventionImage avec les bons paramètres', async () => {
      global.getRouterParam.mockReturnValue('456');

      const customUser = { id: 789, email: 'custom@example.com' };
      const customEvent = { context: { user: customUser } };

      await handler(customEvent as any);

      expect(mockDeleteConventionImage).toHaveBeenCalledWith(456, 789);
      expect(mockDeleteConventionImage).toHaveBeenCalledTimes(1);
    });

    it('devrait transférer tous les détails de la réponse', async () => {
      global.getRouterParam.mockReturnValue('1');

      const customResponse = {
        success: true,
        message: 'Logo de convention supprimé avec succès',
        entity: {
          id: 1,
          nom: 'EJC 2024',
          description: 'European Juggling Convention',
          logo: null,
          authorId: 1,
          author: { id: 1, pseudo: 'organizer', email: 'org@ejc.com' },
        },
      };

      mockDeleteConventionImage.mockResolvedValue(customResponse);

      const result = await handler(mockEvent as any);

      expect(result).toEqual({
        success: true,
        message: 'Logo de convention supprimé avec succès',
        convention: customResponse.entity,
      });
    });
  });
});