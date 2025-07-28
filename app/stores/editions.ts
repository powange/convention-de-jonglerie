import { defineStore } from 'pinia';
import { useAuthStore } from '../stores/auth'; // Use relative path



export const useEditionStore = defineStore('editions', {
  state: () => ({
    editions: [] as Edition[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    // Filtrer les éditions futures (date de fin >= aujourd'hui)
    filterFutureEditions() {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Début de la journée actuelle
      
      this.editions = this.editions.filter(edition => {
        const endDate = new Date(edition.endDate);
        return endDate >= now; // Garder seulement les éditions qui ne sont pas encore terminées
      });
    },

    // Trier les éditions par date de début (plus récente en premier)
    sortEditions() {
      this.editions.sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateB.getTime() - dateA.getTime(); // Tri décroissant (plus récent en premier)
      });
    },

    // Appliquer le filtrage et le tri des éditions
    processEditions() {
      this.filterFutureEditions();
      this.sortEditions();
    },
    async fetchEditions(filters?: any) {
      this.loading = true;
      this.error = null;
      try {
        const queryParams: { [key: string]: string } = {};
        
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

        const data = await $fetch<Edition[]>('/api/editions', {
          params: queryParams,
        });
        this.editions = data;
        this.processEditions();
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to fetch editions';
      } finally {
        this.loading = false;
      }
    },

    async fetchEditionById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const edition = await $fetch<Edition>(`/api/editions/${id}`);
        return edition;
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to fetch edition';
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
        this.error = e.statusMessage || 'Failed to add edition';
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
        this.error = e.statusMessage || 'Failed to update edition';
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
        this.error = e.statusMessage || 'Failed to delete edition';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async toggleFavorite(id: number) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        await $fetch(`/api/editions/${id}/favorite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        // Re-fetch editions to update favorite status
        await this.fetchEditions();
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to toggle favorite';
        throw e;
      } finally {
        this.loading = false;
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
        this.error = e.statusMessage || 'Failed to fetch collaborators';
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
        this.error = e.statusMessage || 'Failed to add collaborator';
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
        this.error = e.statusMessage || 'Failed to remove collaborator';
        throw e;
      }
    },

    // Vérifier si l'utilisateur peut modifier une édition
    canEditEdition(edition: Edition, userId: number): boolean {
      // Le créateur peut toujours modifier
      if (edition.creatorId === userId) {
        return true;
      }
      
      // Vérifier si l'utilisateur est collaborateur avec droits d'édition
      return edition.collaborators?.some(
        collaborator => collaborator.userId === userId && collaborator.canEdit
      ) || false;
    },

    // Vérifier si l'utilisateur peut supprimer une édition (seul le créateur)
    canDeleteEdition(edition: Edition, userId: number): boolean {
      return edition.creatorId === userId;
    },
  },
});