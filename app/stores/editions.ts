import { defineStore } from 'pinia'

import type { Edition, ConventionOrganizer, HttpError } from '~/types'

import { useAuthStore } from '../stores/auth' // Use relative path

// Interface pour les filtres d'éditions
interface EditionFilters {
  page?: number
  limit?: number
  name?: string
  startDate?: string
  endDate?: string
  countries?: string[]
  includeOffline?: boolean
  // Filtres temporels
  showPast?: boolean
  showCurrent?: boolean
  showFuture?: boolean
  // Services/équipements
  hasFoodTrucks?: boolean
  hasKidsZone?: boolean
  acceptsPets?: boolean
  hasTentCamping?: boolean
  hasTruckCamping?: boolean
  hasGym?: boolean
  hasFamilyCamping?: boolean
  hasSleepingRoom?: boolean
  hasFireSpace?: boolean
  hasGala?: boolean
  hasOpenStage?: boolean
  hasConcert?: boolean
  hasCantine?: boolean
  hasAerialSpace?: boolean
  hasSlacklineSpace?: boolean
  hasToilets?: boolean
  hasShowers?: boolean
  hasAccessibility?: boolean
  hasWorkshops?: boolean
  hasCashPayment?: boolean
  hasCreditCardPayment?: boolean
  hasAfjTokenPayment?: boolean
  hasLongShow?: boolean
  hasATM?: boolean
}

// Interface pour la réponse paginée
interface PaginatedResponse {
  data: Edition[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const useEditionStore = defineStore('editions', {
  state: () => ({
    editions: [] as Edition[],
    loading: false,
    error: null as string | null,
    pagination: {
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 0,
    },
    // Promesses en cours pour éviter les requêtes doublons simultanées
    _pendingEditionFetches: {} as Record<number, Promise<Edition> | undefined>,
    // Toutes les éditions pour l'agenda (sans pagination)
    allEditions: [] as Edition[],
  }),
  getters: {
    getEditionById: (state) => (id: number) => {
      return state.editions.find((edition) => edition.id === id)
    },
  },
  actions: {
    // Filtrer les éditions futures (date de fin >= aujourd'hui) - OBSOLÈTE: géré par le filtre temporel
    filterFutureEditions() {
      // Cette méthode est maintenant obsolète car le filtrage temporel est géré par l'API
      // et les filtres utilisateur (showPast, showCurrent, showFuture)
    },

    // Trier les éditions par ordre chronologique (plus ancienne en premier)
    sortEditions() {
      this.editions.sort((a, b) => {
        const dateA = new Date(a.startDate)
        const dateB = new Date(b.startDate)
        return dateA.getTime() - dateB.getTime() // Tri croissant (plus ancien en premier)
      })
    },

    // Appliquer le filtrage et le tri des éditions
    processEditions() {
      this.filterFutureEditions()
      this.sortEditions()
    },
    async fetchEditions(filters?: EditionFilters) {
      this.loading = true
      this.error = null
      try {
        const queryParams: { [key: string]: string } = {}

        // Paramètres de pagination
        queryParams.page = (filters?.page || 1).toString()
        queryParams.limit = (filters?.limit || 12).toString()

        // Filtres de base
        if (filters?.name) {
          queryParams.name = filters.name
        }
        if (filters?.startDate) {
          queryParams.startDate = filters.startDate
        }
        if (filters?.endDate) {
          queryParams.endDate = filters.endDate
        }
        if (filters?.countries && filters.countries.length > 0) {
          queryParams.countries = JSON.stringify(filters.countries)
        }

        // Filtres temporels
        if (filters?.showPast !== undefined) {
          queryParams.showPast = filters.showPast.toString()
        }
        if (filters?.showCurrent !== undefined) {
          queryParams.showCurrent = filters.showCurrent.toString()
        }
        if (filters?.showFuture !== undefined) {
          queryParams.showFuture = filters.showFuture.toString()
        }

        // Filtre includeOffline pour voir les éditions hors ligne
        if (filters?.includeOffline !== undefined) {
          queryParams.includeOffline = filters.includeOffline.toString()
        }

        // Filtres de services - passer tous les services actifs
        if (filters) {
          Object.keys(filters).forEach((key) => {
            if (key.startsWith('has') || key === 'acceptsPets') {
              if ((filters as Record<string, any>)[key] === true) {
                ;(queryParams as Record<string, any>)[key] = 'true'
              }
            }
          })
        }

        const response = await $fetch<PaginatedResponse>('/api/editions', {
          params: queryParams,
        })
        this.editions = response.data
        this.pagination = response.pagination
        this.processEditions()
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to fetch editions'
      } finally {
        this.loading = false
      }
    },

    async fetchEditionById(id: number, opts?: { force?: boolean }) {
      // Retourner immédiatement depuis le cache si disponible et pas de force
      const existing = this.editions.find((e) => e.id === id)
      if (existing && !opts?.force) return existing

      // Re-utiliser une requête déjà en cours
      if (this._pendingEditionFetches[id]) {
        return this._pendingEditionFetches[id]!
      }

      this.loading = true
      this.error = null
      const p = $fetch<Edition>(`/api/editions/${id}`)
        .then((edition) => {
          const existingIndex = this.editions.findIndex((e) => e.id === id)
          if (existingIndex !== -1) this.editions[existingIndex] = edition
          else this.editions.push(edition)
          return edition
        })
        .catch((e: unknown) => {
          const error = e as HttpError
          this.error = error.message || error.data?.message || 'Failed to fetch edition'
          throw e
        })
        .finally(() => {
          this.loading = false
          this._pendingEditionFetches[id] = undefined
        })

      this._pendingEditionFetches[id] = p
      return p
    },

    // Setter pour mettre à jour ou ajouter une édition dans le cache
    setEdition(edition: Edition) {
      const existingIndex = this.editions.findIndex((e) => e.id === edition.id)
      if (existingIndex !== -1) {
        // Mettre à jour l'édition existante
        this.editions[existingIndex] = edition
      } else {
        // Ajouter la nouvelle édition
        this.editions.push(edition)
      }
    },

    async addEdition(editionData: Omit<Edition, 'id' | 'creator' | 'creatorId'>) {
      this.loading = true
      this.error = null
      try {
        const response = await $fetch<{ success: boolean; data: Edition }>('/api/editions', {
          method: 'POST',
          body: editionData,
        })
        const newEdition = response.data
        // Utiliser setEdition pour éviter la duplication de logique
        this.setEdition(newEdition)
        this.processEditions()
        return newEdition
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to add edition'
        throw e
      } finally {
        this.loading = false
      }
    },

    async updateEdition(id: number, editionData: Edition) {
      this.loading = true
      this.error = null
      try {
        const response = await $fetch<{ success: boolean; data: Edition }>(`/api/editions/${id}`, {
          method: 'PUT',
          body: editionData,
        })
        const updatedEdition = response.data
        const index = this.editions.findIndex((c) => c.id === id)
        if (index !== -1) {
          this.editions[index] = updatedEdition
          this.processEditions()
        }
        return updatedEdition
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to update edition'
        throw e
      } finally {
        this.loading = false
      }
    },

    async deleteEdition(id: number) {
      this.loading = true
      this.error = null
      try {
        await $fetch(`/api/editions/${id}`, {
          method: 'DELETE',
        })
        this.editions = this.editions.filter((c) => c.id !== id)
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to delete edition'
        throw e
      } finally {
        this.loading = false
      }
    },

    // Méthodes pour gérer les organisateurs
    async getOrganizers(editionId: number) {
      this.error = null
      try {
        const organizers = await $fetch<ConventionOrganizer[]>(
          `/api/editions/${editionId}/organizers`
        )
        return organizers
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to fetch organizers'
        throw e
      }
    },

    async addOrganizer(editionId: number, userEmail: string, canEdit: boolean = true) {
      this.error = null
      try {
        const organizer = await $fetch<ConventionOrganizer>(
          `/api/editions/${editionId}/organizers`,
          {
            method: 'POST',
            body: { userEmail, canEdit },
          }
        )

        // Mettre à jour l'édition locale avec le nouveau organisateur
        const editionIndex = this.editions.findIndex((c) => c.id === editionId)
        if (editionIndex !== -1) {
          const ed = this.editions[editionIndex]
          ;(ed as any).organizers = (ed as any).organizers || []
          ;(ed as any).organizers.push(organizer as any)
        }

        return organizer
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to add organizer'
        throw e
      }
    },

    async removeOrganizer(editionId: number, organizerId: number) {
      this.error = null
      try {
        await $fetch(`/api/editions/${editionId}/organizers/${organizerId}`, {
          method: 'DELETE',
        })

        // Mettre à jour l'édition locale
        const editionIndex = this.editions.findIndex((c) => c.id === editionId)
        if (editionIndex !== -1) {
          const ed = this.editions[editionIndex] as any
          if (ed?.organizers) {
            ed.organizers = ed.organizers.filter((c: any) => c.id !== organizerId)
          }
        }
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to remove organizer'
        throw e
      }
    },

    // Vérifier si l'utilisateur peut modifier une édition
    canEditEdition(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin peuvent tout modifier
      if (authStore.isAdminModeActive) {
        return true
      }

      // Le créateur de l'édition peut toujours modifier
      if (edition.creatorId && edition.creatorId === userId) {
        return true
      }

      // Vérifier si la convention a des organisateurs
      if (!edition.convention || !edition.convention.organizers) {
        return false
      }

      // L'auteur de la convention peut modifier toutes les éditions
      if (edition.convention.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Organisateur avec droits explicites
      return edition.convention.organizers.some((collab) => {
        if (collab.user.id !== userId) return false
        // Droit global d'éditer la convention implique édition des éditions
        if (collab.rights?.editConvention || collab.rights?.editAllEditions) return true
        // Droit spécifique sur cette édition (perEditionRights)
        if (collab.perEditionRights) {
          const per = collab.perEditionRights.find((r) => r.editionId === edition.id)
          if (per?.canEdit) return true
        }
        return false
      })
    },

    // Vérifier si l'utilisateur peut supprimer une édition
    canDeleteEdition(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin peuvent tout supprimer
      if (authStore.isAdminModeActive) {
        return true
      }

      // Le créateur de l'édition peut supprimer
      if (edition.creatorId && edition.creatorId === userId) {
        return true
      }

      // Vérifier si la convention a des organisateurs
      if (!edition.convention || !edition.convention.organizers) {
        return false
      }

      // L'auteur de la convention peut supprimer toutes les éditions
      if (edition.convention.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Organisateur avec droits explicites
      return edition.convention.organizers.some((collab) => {
        if (collab.user.id !== userId) return false
        if (collab.rights?.deleteConvention || collab.rights?.deleteAllEditions) return true
        if (collab.perEditionRights) {
          const per = collab.perEditionRights.find((r) => r.editionId === edition.id)
          if (per?.canDelete) return true
        }
        return false
      })
    },

    // Vérifier si l'utilisateur peut gérer les bénévoles d'une édition
    canManageVolunteers(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin peuvent tout gérer
      if (authStore.isAdminModeActive) {
        return true
      }

      // Le créateur de l'édition peut gérer les bénévoles
      if (edition.creatorId && edition.creatorId === userId) {
        return true
      }

      // Vérifier si la convention a des organisateurs
      if (!edition.convention || !edition.convention.organizers) {
        return false
      }

      // L'auteur de la convention peut gérer tous les bénévoles
      if (edition.convention.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Organisateur avec droits explicites
      return edition.convention.organizers.some((collab) => {
        if (collab.user.id !== userId) return false
        // Droit global de gérer les bénévoles
        if (collab.rights?.manageVolunteers) return true
        // Droit global d'éditer la convention implique gestion des bénévoles
        if (collab.rights?.editConvention || collab.rights?.editAllEditions) return true
        // Droit spécifique sur cette édition
        if (collab.perEditionRights) {
          const per = collab.perEditionRights.find((r) => r.editionId === edition.id)
          if (per?.canManageVolunteers || per?.canEdit) return true
        }
        return false
      })
    },

    // Vérifier si l'utilisateur peut gérer les artistes d'une édition
    canManageArtists(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin peuvent tout gérer
      if (authStore.isAdminModeActive) {
        return true
      }

      // Le créateur de l'édition peut gérer les artistes
      if (edition.creatorId && edition.creatorId === userId) {
        return true
      }

      // Vérifier si la convention a des organisateurs
      if (!edition.convention || !edition.convention.organizers) {
        return false
      }

      // L'auteur de la convention peut gérer tous les artistes
      if (edition.convention.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Organisateur avec droits explicites
      return edition.convention.organizers.some((collab) => {
        if (collab.user.id !== userId) return false
        // Droit global de gérer les artistes
        if (collab.rights?.manageArtists) return true
        // Droit global d'éditer la convention implique gestion des artistes
        if (collab.rights?.editConvention || collab.rights?.editAllEditions) return true
        // Droit spécifique sur cette édition
        if (collab.perEditionRights) {
          const per = collab.perEditionRights.find((r) => r.editionId === edition.id)
          if (per?.canManageArtists || per?.canEdit) return true
        }
        return false
      })
    },

    // Vérifier si l'utilisateur peut gérer les organisateurs d'une convention
    canManageOrganizers(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin peuvent tout gérer
      if (authStore.isAdminModeActive) {
        return true
      }

      // Vérifier si la convention a des organisateurs
      if (!edition.convention || !edition.convention.organizers) {
        // Si pas de organisateurs et c'est l'auteur de la convention, il peut gérer
        return edition.convention?.authorId && edition.convention.authorId === userId
      }

      // L'auteur de la convention peut toujours gérer les organisateurs
      if (edition.convention.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Organisateur avec droit explicite de gestion des organisateurs
      return edition.convention.organizers.some((collab) => {
        if (collab.user.id !== userId) return false
        // Droit global de gérer les organisateurs
        if (collab.rights?.manageOrganizers) return true
        return false
      })
    },

    // Vérifier si l'utilisateur est organisateur d'une convention
    isOrganizer(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore()

      // Les admins globaux en mode admin sont considérés comme organisateurs
      if (authStore.isAdminModeActive) {
        return true
      }

      // L'auteur de la convention est toujours organisateur
      if (edition.convention?.authorId && edition.convention.authorId === userId) {
        return true
      }

      // Vérifier si l'utilisateur est dans la liste des organisateurs
      if (!edition.convention?.organizers) {
        return false
      }

      return edition.convention.organizers.some((collab) => collab.user.id === userId)
    },

    // Vérifier si l'utilisateur est responsable d'au moins une équipe de bénévoles
    async isTeamLeader(editionId: number, _userId: number): Promise<boolean> {
      const authStore = useAuthStore()

      // Les admins globaux ne sont pas considérés comme team leaders
      // (ils ont déjà accès via leurs droits admin)
      if (authStore.isAdminModeActive) {
        return false
      }

      try {
        const response = await $fetch<{ isTeamLeader: boolean }>(
          `/api/editions/${editionId}/volunteers/is-team-leader`
        )
        return response.isTeamLeader
      } catch (error) {
        console.error('Error checking team leader status:', error)
        return false
      }
    },

    // Récupérer toutes les éditions sans pagination (pour l'agenda)
    async fetchAllEditions(filters?: Omit<EditionFilters, 'page' | 'limit'>) {
      this.loading = true
      this.error = null
      try {
        const queryParams: { [key: string]: string } = {}

        // Récupérer un grand nombre d'éditions (pas de pagination réelle)
        queryParams.limit = '10000' // Limite très élevée pour récupérer toutes les éditions

        // Filtres de base
        if (filters?.name) {
          queryParams.name = filters.name
        }
        if (filters?.startDate) {
          queryParams.startDate = filters.startDate
        }
        if (filters?.endDate) {
          queryParams.endDate = filters.endDate
        }
        if (filters?.countries && filters.countries.length > 0) {
          queryParams.countries = JSON.stringify(filters.countries)
        }

        // Filtres temporels
        if (filters?.showPast !== undefined) {
          queryParams.showPast = filters.showPast.toString()
        }
        if (filters?.showCurrent !== undefined) {
          queryParams.showCurrent = filters.showCurrent.toString()
        }
        if (filters?.showFuture !== undefined) {
          queryParams.showFuture = filters.showFuture.toString()
        }

        // Filtre includeOffline pour voir les éditions hors ligne
        if (filters?.includeOffline !== undefined) {
          queryParams.includeOffline = filters.includeOffline.toString()
        }

        // Filtres de services - passer tous les services actifs
        if (filters) {
          Object.keys(filters).forEach((key) => {
            if (key.startsWith('has') || key === 'acceptsPets') {
              if ((filters as Record<string, any>)[key] === true) {
                ;(queryParams as Record<string, any>)[key] = 'true'
              }
            }
          })
        }

        const response = await $fetch<PaginatedResponse>('/api/editions', {
          params: queryParams,
        })
        this.allEditions = response.data
        this.processAllEditions()
      } catch (e: unknown) {
        const error = e as HttpError
        this.error = error.message || error.data?.message || 'Failed to fetch all editions'
      } finally {
        this.loading = false
      }
    },

    // Traiter toutes les éditions (tri seulement)
    processAllEditions() {
      this.allEditions.sort((a, b) => {
        const dateA = new Date(a.startDate)
        const dateB = new Date(b.startDate)
        return dateA.getTime() - dateB.getTime() // Tri croissant (plus ancien en premier)
      })
    },
  },
})
