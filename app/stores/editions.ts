import { defineStore } from 'pinia';
import { useAuthStore } from '../stores/auth'; // Use relative path
import type { Edition, ConventionCollaborator, HttpError } from '~/types';

// Interface pour les filtres d'éditions
interface EditionFilters {
  page?: number;
  limit?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  countries?: string[];
  // Filtres temporels
  showPast?: boolean;
  showCurrent?: boolean;
  showFuture?: boolean;
  // Services/équipements
  hasFoodTrucks?: boolean;
  hasKidsZone?: boolean;
  acceptsPets?: boolean;
  hasTentCamping?: boolean;
  hasTruckCamping?: boolean;
  hasGym?: boolean;
  hasFamilyCamping?: boolean;
  hasFireSpace?: boolean;
  hasGala?: boolean;
  hasOpenStage?: boolean;
  hasConcert?: boolean;
  hasCantine?: boolean;
  hasAerialSpace?: boolean;
  hasSlacklineSpace?: boolean;
  hasToilets?: boolean;
  hasShowers?: boolean;
  hasAccessibility?: boolean;
  hasWorkshops?: boolean;
  hasCreditCardPayment?: boolean;
  hasAfjTokenPayment?: boolean;
  hasLongShow?: boolean;
  hasATM?: boolean;
}



// Interface pour la réponse paginée
interface PaginatedResponse {
  data: Edition[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
      totalPages: 0
    }
  }),
  getters: {
    getEditionById: (state) => (id: number) => {
      return state.editions.find(edition => edition.id === id);
    }
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
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA.getTime() - dateB.getTime(); // Tri croissant (plus ancien en premier)
      });
    },

    // Appliquer le filtrage et le tri des éditions
    processEditions() {
      this.filterFutureEditions();
      this.sortEditions();
    },
    async fetchEditions(filters?: EditionFilters) {
      this.loading = true;
      this.error = null;
      try {
        const queryParams: { [key: string]: string } = {};
        
        // Paramètres de pagination
        queryParams.page = (filters?.page || 1).toString();
        queryParams.limit = (filters?.limit || 12).toString();
        
        // Filtres de base
        if (filters?.name) {
          queryParams.name = filters.name;
        }
        if (filters?.startDate) {
          queryParams.startDate = filters.startDate;
        }
        if (filters?.endDate) {
          queryParams.endDate = filters.endDate;
        }
        if (filters?.countries && filters.countries.length > 0) {
          queryParams.countries = JSON.stringify(filters.countries);
        }

        // Filtres temporels
        if (filters?.showPast !== undefined) {
          queryParams.showPast = filters.showPast.toString();
        }
        if (filters?.showCurrent !== undefined) {
          queryParams.showCurrent = filters.showCurrent.toString();
        }
        if (filters?.showFuture !== undefined) {
          queryParams.showFuture = filters.showFuture.toString();
        }

        // Filtres de services - passer tous les services actifs
        if (filters) {
          Object.keys(filters).forEach(key => {
            if (key.startsWith('has') || key === 'acceptsPets') {
              if (filters[key] === true) {
                queryParams[key] = 'true';
              }
            }
          });
        }

        const response = await $fetch<PaginatedResponse>('/api/editions', {
          params: queryParams,
        });
        this.editions = response.data;
        this.pagination = response.pagination;
        this.processEditions();
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to fetch editions';
      } finally {
        this.loading = false;
      }
    },

    async fetchEditionById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const edition = await $fetch<Edition>(`/api/editions/${id}`);
        
        // Ajouter l'édition au store si elle n'y est pas déjà
        const existingIndex = this.editions.findIndex(e => e.id === id);
        if (existingIndex !== -1) {
          this.editions[existingIndex] = edition;
        } else {
          this.editions.push(edition);
        }
        
        return edition;
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to fetch edition';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async addEdition(editionData: Omit<Edition, 'id' | 'creator' | 'creatorId' | 'favoritedBy'>) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        const newEdition = await $fetch<Edition>('/api/editions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: editionData,
        });
        this.editions.push(newEdition);
        this.processEditions();
        return newEdition;
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to add edition';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async updateEdition(id: number, editionData: Edition) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        const updatedEdition = await $fetch<Edition>(`/api/editions/${id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
            },
            body: editionData,
          },
        );
        const index = this.editions.findIndex((c) => c.id === id);
        if (index !== -1) {
          this.editions[index] = updatedEdition;
          this.processEditions();
        }
        return updatedEdition;
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to update edition';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteEdition(id: number) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        await $fetch(`/api/editions/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        this.editions = this.editions.filter((c) => c.id !== id);
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to delete edition';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async toggleFavorite(id: number) {
      this.error = null;
      const authStore = useAuthStore();
      const currentUser = authStore.user;
      
      // Optimistic update - mise à jour locale immédiate
      const editionIndex = this.editions.findIndex(e => e.id === id);
      if (editionIndex !== -1 && currentUser) {
        const edition = this.editions[editionIndex];
        const isFavorited = edition.favoritedBy.some(u => u.id === currentUser.id);
        
        if (isFavorited) {
          // Retirer des favoris
          edition.favoritedBy = edition.favoritedBy.filter(u => u.id !== currentUser.id);
        } else {
          // Ajouter aux favoris
          edition.favoritedBy.push({
            id: currentUser.id,
            email: currentUser.email,
            pseudo: currentUser.pseudo
          });
        }
      }
      
      try {
        // Appel API en arrière-plan
        const response = await $fetch(`/api/editions/${id}/favorite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        
        // Mettre à jour avec la réponse du serveur si nécessaire
        if (response && editionIndex !== -1) {
          // Si le serveur renvoie l'édition mise à jour, l'utiliser
          if (response.edition) {
            this.editions[editionIndex] = response.edition;
          }
        }
      } catch (e: unknown) {
        // En cas d'erreur, annuler l'optimistic update
        if (editionIndex !== -1 && currentUser) {
          const edition = this.editions[editionIndex];
          const isFavorited = edition.favoritedBy.some(u => u.id === currentUser.id);
          
          if (isFavorited) {
            // Si on avait ajouté, on retire
            edition.favoritedBy = edition.favoritedBy.filter(u => u.id !== currentUser.id);
          } else {
            // Si on avait retiré, on remet
            edition.favoritedBy.push({
              id: currentUser.id,
              email: currentUser.email,
              pseudo: currentUser.pseudo
            });
          }
        }
        
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to toggle favorite';
        throw e;
      }
    },

    // Méthodes pour gérer les collaborateurs
    async getCollaborators(editionId: number) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        const collaborators = await $fetch<ConventionCollaborator[]>(`/api/editions/${editionId}/collaborators`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        return collaborators;
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to fetch collaborators';
        throw e;
      }
    },

    async addCollaborator(editionId: number, userEmail: string, canEdit: boolean = true) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        const collaborator = await $fetch<ConventionCollaborator>(`/api/editions/${editionId}/collaborators`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: { userEmail, canEdit },
        });
        
        // Mettre à jour l'édition locale avec le nouveau collaborateur
        const editionIndex = this.editions.findIndex(c => c.id === editionId);
        if (editionIndex !== -1) {
          if (!this.editions[editionIndex].collaborators) {
            this.editions[editionIndex].collaborators = [];
          }
          this.editions[editionIndex].collaborators!.push(collaborator);
        }
        
        return collaborator;
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to add collaborator';
        throw e;
      }
    },

    async removeCollaborator(editionId: number, collaboratorId: number) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        await $fetch(`/api/editions/${editionId}/collaborators/${collaboratorId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        
        // Mettre à jour l'édition locale
        const editionIndex = this.editions.findIndex(c => c.id === editionId);
        if (editionIndex !== -1 && this.editions[editionIndex].collaborators) {
          this.editions[editionIndex].collaborators = this.editions[editionIndex].collaborators!.filter(
            c => c.id !== collaboratorId
          );
        }
      } catch (e: unknown) {
        const error = e as HttpError;
        this.error = error.message || error.data?.message || 'Failed to remove collaborator';
        throw e;
      }
    },

    // Vérifier si l'utilisateur peut modifier une édition
    canEditEdition(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore();
      
      // Les admins globaux en mode admin peuvent tout modifier
      if (authStore.isAdminModeActive) {
        return true;
      }
      
      // Le créateur de l'édition peut toujours modifier
      if (edition.creatorId === userId) {
        return true;
      }
      
      // Vérifier si la convention a des collaborateurs
      if (!edition.convention || !edition.convention.collaborators) {
        return false;
      }
      
      // L'auteur de la convention peut modifier toutes les éditions
      if (edition.convention.authorId === userId) {
        return true;
      }
      
      // Les collaborateurs (MODERATOR ou ADMINISTRATOR) peuvent modifier
      return edition.convention.collaborators.some(
        collab => collab.user.id === userId && (collab.role === 'MODERATOR' || collab.role === 'ADMINISTRATOR')
      ) || false;
    },

    // Vérifier si l'utilisateur peut supprimer une édition
    canDeleteEdition(edition: Edition, userId: number): boolean {
      const authStore = useAuthStore();
      
      // Les admins globaux en mode admin peuvent tout supprimer
      if (authStore.isAdminModeActive) {
        return true;
      }
      
      // Le créateur de l'édition peut supprimer
      if (edition.creatorId === userId) {
        return true;
      }
      
      // Vérifier si la convention a des collaborateurs
      if (!edition.convention || !edition.convention.collaborators) {
        return false;
      }
      
      // L'auteur de la convention peut supprimer toutes les éditions
      if (edition.convention.authorId === userId) {
        return true;
      }
      
      // Les collaborateurs (MODERATOR ou ADMINISTRATOR) peuvent supprimer
      return edition.convention.collaborators.some(
        collab => collab.user.id === userId && (collab.role === 'MODERATOR' || collab.role === 'ADMINISTRATOR')
      ) || false;
    },
  },
});