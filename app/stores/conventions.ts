import { defineStore } from 'pinia';
import { useAuthStore } from '../stores/auth'; // Use relative path



export const useConventionStore = defineStore('conventions', {
  state: () => ({
    conventions: [] as Convention[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    // Filtrer les conventions futures (date de fin >= aujourd'hui)
    filterFutureConventions() {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Début de la journée actuelle
      
      this.conventions = this.conventions.filter(convention => {
        const endDate = new Date(convention.endDate);
        return endDate >= now; // Garder seulement les conventions qui ne sont pas encore terminées
      });
    },

    // Trier les conventions par date de début (plus récente en premier)
    sortConventions() {
      this.conventions.sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateB.getTime() - dateA.getTime(); // Tri décroissant (plus récent en premier)
      });
    },

    // Appliquer le filtrage et le tri des conventions
    processConventions() {
      this.filterFutureConventions();
      this.sortConventions();
    },
    async fetchConventions(filters?: any) {
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

        const data = await $fetch<Convention[]>('/api/conventions', {
          params: queryParams,
        });
        this.conventions = data;
        this.processConventions();
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to fetch conventions';
      } finally {
        this.loading = false;
      }
    },

    async fetchConventionById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const convention = await $fetch<Convention>(`/api/conventions/${id}`);
        return convention;
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to fetch convention';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async addConvention(conventionData: Omit<Convention, 'id' | 'creator' | 'creatorId' | 'favoritedBy'>) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        const newConvention = await $fetch<Convention>('/api/conventions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: conventionData,
        });
        this.conventions.push(newConvention);
        this.processConventions();
        return newConvention;
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to add convention';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async updateConvention(id: number, conventionData: Convention) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        const updatedConvention = await $fetch<Convention>(`/api/conventions/${id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
            },
            body: conventionData,
          },
        );
        const index = this.conventions.findIndex((c) => c.id === id);
        if (index !== -1) {
          this.conventions[index] = updatedConvention;
          this.processConventions();
        }
        return updatedConvention;
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to update convention';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteConvention(id: number) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();
      try {
        await $fetch(`/api/conventions/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        this.conventions = this.conventions.filter((c) => c.id !== id);
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to delete convention';
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
        await $fetch(`/api/conventions/${id}/favorite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        // Re-fetch conventions to update favorite status
        await this.fetchConventions();
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to toggle favorite';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    // Méthodes pour gérer les collaborateurs
    async getCollaborators(conventionId: number) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        const collaborators = await $fetch<ConventionCollaborator[]>(`/api/conventions/${conventionId}/collaborators`, {
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

    async addCollaborator(conventionId: number, userEmail: string, canEdit: boolean = true) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        const collaborator = await $fetch<ConventionCollaborator>(`/api/conventions/${conventionId}/collaborators`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: { userEmail, canEdit },
        });
        
        // Mettre à jour la convention locale avec le nouveau collaborateur
        const conventionIndex = this.conventions.findIndex(c => c.id === conventionId);
        if (conventionIndex !== -1) {
          if (!this.conventions[conventionIndex].collaborators) {
            this.conventions[conventionIndex].collaborators = [];
          }
          this.conventions[conventionIndex].collaborators!.push(collaborator);
        }
        
        return collaborator;
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to add collaborator';
        throw e;
      }
    },

    async removeCollaborator(conventionId: number, collaboratorId: number) {
      this.error = null;
      const authStore = useAuthStore();
      try {
        await $fetch(`/api/conventions/${conventionId}/collaborators/${collaboratorId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        
        // Mettre à jour la convention locale
        const conventionIndex = this.conventions.findIndex(c => c.id === conventionId);
        if (conventionIndex !== -1 && this.conventions[conventionIndex].collaborators) {
          this.conventions[conventionIndex].collaborators = this.conventions[conventionIndex].collaborators!.filter(
            c => c.id !== collaboratorId
          );
        }
      } catch (e: unknown) {
        this.error = e.statusMessage || 'Failed to remove collaborator';
        throw e;
      }
    },

    // Vérifier si l'utilisateur peut modifier une convention
    canEditConvention(convention: Convention, userId: number): boolean {
      // Le créateur peut toujours modifier
      if (convention.creatorId === userId) {
        return true;
      }
      
      // Vérifier si l'utilisateur est collaborateur avec droits d'édition
      return convention.collaborators?.some(
        collaborator => collaborator.userId === userId && collaborator.canEdit
      ) || false;
    },

    // Vérifier si l'utilisateur peut supprimer une convention (seul le créateur)
    canDeleteConvention(convention: Convention, userId: number): boolean {
      return convention.creatorId === userId;
    },
  },
});
