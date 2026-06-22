import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { useFavoritesEditionsStore } from '../../../app/stores/favoritesEditions'

// Mock de $fetch (auto-import Nuxt)
global.$fetch = vi.fn() as any

// Mock de useAuthStore (auto-import Nuxt) — le store favoritesEditions appelle
// useAuthStore() sans import explicite. On expose un mock global réutilisable.
const mockAuthStore = {
  isAuthenticated: true,
}
const useAuthStoreMock = vi.fn(() => mockAuthStore)
;(global as any).useAuthStore = useAuthStoreMock

describe('useFavoritesEditionsStore', () => {
  let store: ReturnType<typeof useFavoritesEditionsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFavoritesEditionsStore()

    vi.clearAllMocks()
    // Par défaut, utilisateur authentifié
    mockAuthStore.isAuthenticated = true
    useAuthStoreMock.mockReturnValue(mockAuthStore)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('État initial', () => {
    it('devrait avoir un état initial correct', () => {
      expect(store.favoriteEditionIds).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.isInitialized).toBe(false)
    })
  })

  describe('Getters', () => {
    it('favoritesCount devrait retourner 0 par défaut', () => {
      expect(store.favoritesCount).toBe(0)
    })

    it('favoritesCount devrait retourner le nombre de favoris', () => {
      store.favoriteEditionIds = [1, 2, 3]
      expect(store.favoritesCount).toBe(3)
    })

    it('isFavorite devrait retourner true si édition présente', () => {
      store.favoriteEditionIds = [1, 2, 3]
      expect(store.isFavorite(2)).toBe(true)
    })

    it('isFavorite devrait retourner false si édition absente', () => {
      store.favoriteEditionIds = [1, 2, 3]
      expect(store.isFavorite(99)).toBe(false)
    })
  })

  describe('Mutations addFavorite / removeFavorite', () => {
    it('addFavorite devrait ajouter une édition', () => {
      store.addFavorite(5)
      expect(store.favoriteEditionIds).toContain(5)
    })

    it('addFavorite ne devrait pas ajouter de doublon', () => {
      store.favoriteEditionIds = [5]
      store.addFavorite(5)
      expect(store.favoriteEditionIds).toEqual([5])
    })

    it('removeFavorite devrait retirer une édition', () => {
      store.favoriteEditionIds = [1, 2, 3]
      store.removeFavorite(2)
      expect(store.favoriteEditionIds).toEqual([1, 3])
    })

    it("removeFavorite ne devrait rien faire si l'édition est absente", () => {
      store.favoriteEditionIds = [1, 2, 3]
      store.removeFavorite(99)
      expect(store.favoriteEditionIds).toEqual([1, 2, 3])
    })

    it('clearFavorites devrait vider les favoris et réinitialiser isInitialized', () => {
      store.favoriteEditionIds = [1, 2, 3]
      store.isInitialized = true
      store.clearFavorites()
      expect(store.favoriteEditionIds).toEqual([])
      expect(store.isInitialized).toBe(false)
    })
  })

  describe('Action fetchFavorites', () => {
    it('devrait récupérer les favoris avec succès (utilisateur authentifié)', async () => {
      vi.mocked($fetch).mockResolvedValue({ data: { favoriteIds: [10, 20] } })

      await store.fetchFavorites()

      expect($fetch).toHaveBeenCalledWith('/api/editions/favorites')
      expect(store.favoriteEditionIds).toEqual([10, 20])
      expect(store.isInitialized).toBe(true)
      expect(store.isLoading).toBe(false)
    })

    it('devrait gérer une réponse sans favoriteIds (tableau vide)', async () => {
      vi.mocked($fetch).mockResolvedValue({ data: {} })

      await store.fetchFavorites()

      expect(store.favoriteEditionIds).toEqual([])
      expect(store.isInitialized).toBe(true)
    })

    it("ne devrait pas appeler l'API si l'utilisateur n'est pas authentifié", async () => {
      mockAuthStore.isAuthenticated = false
      store.favoriteEditionIds = [1, 2]

      await store.fetchFavorites()

      expect($fetch).not.toHaveBeenCalled()
      expect(store.favoriteEditionIds).toEqual([])
      expect(store.isInitialized).toBe(true)
    })

    it('devrait gérer les erreurs en initialisant un tableau vide', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked($fetch).mockRejectedValue(new Error('Network error'))
      store.favoriteEditionIds = [1, 2]

      await store.fetchFavorites()

      expect(store.favoriteEditionIds).toEqual([])
      expect(store.isInitialized).toBe(true)
      expect(store.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('devrait définir isLoading pendant le chargement', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked($fetch).mockReturnValue(promise as any)

      const fetchPromise = store.fetchFavorites()
      expect(store.isLoading).toBe(true)

      resolvePromise!({ data: { favoriteIds: [] } })
      await fetchPromise
      expect(store.isLoading).toBe(false)
    })
  })

  describe('Action toggleFavorite', () => {
    it("devrait lever une erreur si l'utilisateur n'est pas authentifié", async () => {
      mockAuthStore.isAuthenticated = false

      await expect(store.toggleFavorite(5)).rejects.toThrow(
        'Vous devez être connecté pour ajouter des favoris'
      )
      expect($fetch).not.toHaveBeenCalled()
    })

    it("devrait ajouter un favori et appeler l'API (optimistic update)", async () => {
      vi.mocked($fetch).mockResolvedValue(undefined)

      await store.toggleFavorite(5)

      expect(store.favoriteEditionIds).toContain(5)
      expect($fetch).toHaveBeenCalledWith('/api/editions/5/favorite', {
        method: 'POST',
      })
    })

    it("devrait retirer un favori existant et appeler l'API", async () => {
      store.favoriteEditionIds = [5]
      vi.mocked($fetch).mockResolvedValue(undefined)

      await store.toggleFavorite(5)

      expect(store.favoriteEditionIds).not.toContain(5)
      expect($fetch).toHaveBeenCalledWith('/api/editions/5/favorite', {
        method: 'POST',
      })
    })

    it("devrait effectuer un rollback de l'ajout en cas d'échec de l'API", async () => {
      vi.mocked($fetch).mockRejectedValue(new Error('Server error'))

      await expect(store.toggleFavorite(5)).rejects.toThrow('Server error')

      // L'ajout optimiste doit être annulé
      expect(store.favoriteEditionIds).not.toContain(5)
    })

    it("devrait effectuer un rollback de la suppression en cas d'échec de l'API", async () => {
      store.favoriteEditionIds = [5]
      vi.mocked($fetch).mockRejectedValue(new Error('Server error'))

      await expect(store.toggleFavorite(5)).rejects.toThrow('Server error')

      // La suppression optimiste doit être annulée
      expect(store.favoriteEditionIds).toContain(5)
    })
  })

  describe('Action ensureInitialized', () => {
    it('devrait appeler fetchFavorites si non initialisé', async () => {
      const fetchSpy = vi.spyOn(store, 'fetchFavorites').mockResolvedValue()

      await store.ensureInitialized()

      expect(fetchSpy).toHaveBeenCalled()
    })

    it('ne devrait pas appeler fetchFavorites si déjà initialisé', async () => {
      store.isInitialized = true
      const fetchSpy = vi.spyOn(store, 'fetchFavorites').mockResolvedValue()

      await store.ensureInitialized()

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('ne devrait pas appeler fetchFavorites si déjà en chargement', async () => {
      store.isLoading = true
      const fetchSpy = vi.spyOn(store, 'fetchFavorites').mockResolvedValue()

      await store.ensureInitialized()

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
