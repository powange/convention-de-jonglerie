import { defineStore } from 'pinia'

export const useFavoritesEditionsStore = defineStore('favoritesEditions', {
  state: () => ({
    favoriteEditionIds: [] as number[],
    isLoading: false,
    isInitialized: false,
  }),

  getters: {
    isFavorite: (state) => {
      return (editionId: number) => state.favoriteEditionIds.includes(editionId)
    },
    favoritesCount: (state) => state.favoriteEditionIds.length,
  },

  actions: {
    async fetchFavorites() {
      const authStore = useAuthStore()

      // Si pas authentifié, réinitialiser les favoris
      if (!authStore.isAuthenticated) {
        this.favoriteEditionIds = []
        this.isInitialized = true
        return
      }

      this.isLoading = true
      try {
        const favoriteIds = await $fetch<number[]>('/api/editions/favorites')
        this.favoriteEditionIds = favoriteIds || []
        this.isInitialized = true
      } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error)
        // En cas d'erreur, initialiser avec un tableau vide
        this.favoriteEditionIds = []
        this.isInitialized = true
      } finally {
        this.isLoading = false
      }
    },

    async toggleFavorite(editionId: number) {
      const authStore = useAuthStore()

      if (!authStore.isAuthenticated) {
        throw new Error('Vous devez être connecté pour ajouter des favoris')
      }

      const wasFavorite = this.isFavorite(editionId)

      // Optimistic update : mettre à jour l'état localement d'abord
      if (wasFavorite) {
        this.removeFavorite(editionId)
      } else {
        this.addFavorite(editionId)
      }

      try {
        // Appel API pour synchroniser avec le serveur
        await $fetch(`/api/editions/${editionId}/favorite`, {
          method: 'POST',
        })
      } catch (error) {
        // Rollback en cas d'erreur
        if (wasFavorite) {
          this.addFavorite(editionId)
        } else {
          this.removeFavorite(editionId)
        }
        throw error
      }
    },

    addFavorite(editionId: number) {
      if (!this.favoriteEditionIds.includes(editionId)) {
        this.favoriteEditionIds.push(editionId)
      }
    },

    removeFavorite(editionId: number) {
      const index = this.favoriteEditionIds.indexOf(editionId)
      if (index !== -1) {
        this.favoriteEditionIds.splice(index, 1)
      }
    },

    clearFavorites() {
      this.favoriteEditionIds = []
      this.isInitialized = false
    },

    // Initialiser les favoris si pas encore fait
    async ensureInitialized() {
      if (!this.isInitialized && !this.isLoading) {
        await this.fetchFavorites()
      }
    },
  },
})
