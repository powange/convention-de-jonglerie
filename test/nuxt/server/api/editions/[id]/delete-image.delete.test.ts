import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../../server/utils/image-deletion', () => ({
  deleteEditionImage: vi.fn(),
}))

import { deleteEditionImage } from '../../../../../../server/utils/image-deletion'
import handler from '../../../../../../server/api/editions/[id]/delete-image.delete'

const mockDeleteEditionImage = deleteEditionImage as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com' },
  },
}

const mockEventWithoutUser = {
  context: {},
}

describe('/api/editions/[id]/delete-image DELETE', () => {
  beforeEach(() => {
    mockDeleteEditionImage.mockReset()
    global.getRouterParam = vi.fn()

    // Valeurs par défaut pour les mocks
    mockDeleteEditionImage.mockResolvedValue({
      success: true,
      message: 'Image supprimée avec succès',
      entity: {
        id: 1,
        nom: 'Édition Test 2024',
        imageUrl: null,
        creatorId: 1,
        creator: { id: 1, pseudo: 'testuser', email: 'test@example.com' },
        favoritedBy: [],
      },
    })
  })

  describe('Authentification', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      global.getRouterParam.mockReturnValue('1')

      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait accepter si utilisateur authentifié', async () => {
      global.getRouterParam.mockReturnValue('1')

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        edition: expect.objectContaining({
          id: 1,
          nom: 'Édition Test 2024',
          imageUrl: null,
        }),
      })
    })
  })

  describe('Validation des paramètres', () => {
    it("devrait rejeter si ID d'édition invalide (non numérique)", async () => {
      global.getRouterParam.mockReturnValue('abc')

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait rejeter si ID d'édition est NaN", async () => {
      global.getRouterParam.mockReturnValue('NaN')

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait rejeter si ID d'édition est undefined", async () => {
      global.getRouterParam.mockReturnValue(undefined)

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait rejeter si ID d'édition est 0", async () => {
      global.getRouterParam.mockReturnValue('0')

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait accepter un ID d'édition valide", async () => {
      global.getRouterParam.mockReturnValue('123')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(123, 1)
    })

    it('devrait accepter les IDs négatifs (!(-1) = false, donc valide)', async () => {
      global.getRouterParam.mockReturnValue('-1')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(-1, 1)
    })

    it('devrait gérer les grands nombres', async () => {
      global.getRouterParam.mockReturnValue('999999999')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(999999999, 1)
    })
  })

  describe('Sécurité et permissions', () => {
    it('devrait vérifier les permissions via deleteEditionImage', async () => {
      global.getRouterParam.mockReturnValue('1')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(1, 1)
    })

    it('devrait rejeter si édition non trouvée', async () => {
      global.getRouterParam.mockReturnValue('999')

      mockDeleteEditionImage.mockRejectedValue({
        statusCode: 404,
        statusMessage: 'Édition introuvable',
      })

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 404,
        statusMessage: 'Édition introuvable',
      })
    })

    it("devrait rejeter si utilisateur n'est pas créateur ni collaborateur", async () => {
      global.getRouterParam.mockReturnValue('1')

      mockDeleteEditionImage.mockRejectedValue({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })
    })

    it("devrait rejeter si collaborateur n'a pas les droits d'édition", async () => {
      global.getRouterParam.mockReturnValue('1')

      mockDeleteEditionImage.mockRejectedValue({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })
    })

    it('devrait rejeter si aucune image à supprimer', async () => {
      global.getRouterParam.mockReturnValue('1')

      mockDeleteEditionImage.mockRejectedValue({
        statusCode: 400,
        statusMessage: 'Aucune image à supprimer',
      })

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 400,
        statusMessage: 'Aucune image à supprimer',
      })
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      global.getRouterParam.mockReturnValue('1')

      mockDeleteEditionImage.mockRejectedValue(new Error('Database error'))

      await expect(handler(mockEvent as any)).rejects.toThrow(
        "Erreur lors de la suppression de l'image"
      )
    })

    it('devrait relancer les erreurs HTTP existantes', async () => {
      global.getRouterParam.mockReturnValue('1')

      const httpError = {
        statusCode: 503,
        statusMessage: 'Service unavailable',
      }

      mockDeleteEditionImage.mockRejectedValue(httpError)

      await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
    })

    it('devrait logger les erreurs en console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.getRouterParam.mockReturnValue('1')
      mockDeleteEditionImage.mockRejectedValue(new Error('Erreur inattendue'))

      await expect(handler(mockEvent as any)).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith(
        "Erreur lors de la suppression de l'image d'édition:",
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('devrait gérer les erreurs de parsing des paramètres', async () => {
      global.getRouterParam.mockImplementation(() => {
        throw new Error('Router param error')
      })

      await expect(handler(mockEvent as any)).rejects.toThrow('Router param error')
    })
  })

  describe('Réponse de succès', () => {
    it('devrait retourner la structure de réponse correcte', async () => {
      global.getRouterParam.mockReturnValue('1')

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        edition: expect.objectContaining({
          id: 1,
          nom: 'Édition Test 2024',
          imageUrl: null,
        }),
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('edition')
      expect(result.success).toBe(true)
    })

    it("devrait inclure les relations de l'entité", async () => {
      global.getRouterParam.mockReturnValue('1')

      const result = await handler(mockEvent as any)

      expect(result.edition).toHaveProperty('creator')
      expect(result.edition).toHaveProperty('favoritedBy')
      expect(result.edition.creator).toEqual({
        id: 1,
        pseudo: 'testuser',
        email: 'test@example.com',
      })
      expect(Array.isArray(result.edition.favoritedBy)).toBe(true)
    })

    it("devrait confirmer que l'imageUrl est null après suppression", async () => {
      global.getRouterParam.mockReturnValue('1')

      const result = await handler(mockEvent as any)

      expect(result.edition.imageUrl).toBeNull()
    })
  })

  describe('Cas limites', () => {
    it("devrait gérer l'ID 1", async () => {
      global.getRouterParam.mockReturnValue('1')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(1, 1)
    })

    it('devrait gérer les IDs avec des zéros en début', async () => {
      global.getRouterParam.mockReturnValue('0123')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(123, 1)
    })

    it('devrait gérer les IDs décimaux (truncation)', async () => {
      global.getRouterParam.mockReturnValue('123.456')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(123, 1)
    })

    it("devrait gérer les espaces dans l'ID", async () => {
      global.getRouterParam.mockReturnValue(' 123 ')

      await handler(mockEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(123, 1)
    })

    it('devrait rejeter les chaînes vides (parseInt("") = NaN, !NaN = true)', async () => {
      global.getRouterParam.mockReturnValue('')

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it('devrait rejeter null (parseInt(null) = NaN, !NaN = true)', async () => {
      global.getRouterParam.mockReturnValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })
  })

  describe('Intégration avec utils/image-deletion', () => {
    it('devrait appeler deleteEditionImage avec les bons paramètres', async () => {
      global.getRouterParam.mockReturnValue('456')

      const customUser = { id: 789, email: 'custom@example.com' }
      const customEvent = { context: { user: customUser } }

      await handler(customEvent as any)

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(456, 789)
      expect(mockDeleteEditionImage).toHaveBeenCalledTimes(1)
    })

    it('devrait transférer tous les détails de la réponse', async () => {
      global.getRouterParam.mockReturnValue('1')

      const customResponse = {
        success: true,
        message: "Image d'édition supprimée avec succès",
        entity: {
          id: 1,
          nom: 'EJC 2024 - Ovar',
          description: 'European Juggling Convention 2024',
          imageUrl: null,
          creatorId: 1,
          creator: { id: 1, pseudo: 'organizer', email: 'org@ejc.com' },
          favoritedBy: [{ id: 2 }, { id: 3 }],
        },
      }

      mockDeleteEditionImage.mockResolvedValue(customResponse)

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        edition: customResponse.entity,
      })
    })

    it('devrait gérer les collaborateurs avec permissions', async () => {
      global.getRouterParam.mockReturnValue('1')

      const collaboratorResponse = {
        success: true,
        message: 'Image supprimée avec succès',
        entity: {
          id: 1,
          nom: 'Convention Collaborateur',
          imageUrl: null,
          creatorId: 2, // Créateur différent
          creator: { id: 2, pseudo: 'creator', email: 'creator@example.com' },
          favoritedBy: [],
        },
      }

      mockDeleteEditionImage.mockResolvedValue(collaboratorResponse)

      const result = await handler(mockEvent as any)

      expect(result.edition.creatorId).toBe(2)
      expect(result.edition.creator.id).toBe(2)
    })
  })

  describe('Sécurité spécifique aux éditions', () => {
    it('devrait vérifier que seuls les créateurs et collaborateurs autorisés peuvent supprimer', async () => {
      global.getRouterParam.mockReturnValue('1')

      // Simuler une tentative de suppression par un utilisateur non autorisé
      mockDeleteEditionImage.mockRejectedValue({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
      })

      expect(mockDeleteEditionImage).toHaveBeenCalledWith(1, 1)
    })

    it("devrait permettre la suppression aux collaborateurs avec droits d'édition", async () => {
      global.getRouterParam.mockReturnValue('1')

      const collaboratorSuccess = {
        success: true,
        message: 'Image supprimée avec succès par collaborateur',
        entity: {
          id: 1,
          nom: 'Édition Collaborative',
          imageUrl: null,
          creatorId: 99, // Créateur différent
          creator: { id: 99, pseudo: 'originalcreator', email: 'original@example.com' },
          favoritedBy: [],
        },
      }

      mockDeleteEditionImage.mockResolvedValue(collaboratorSuccess)

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
