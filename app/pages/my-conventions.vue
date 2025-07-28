<template>
  <div>
    <!-- Section Conventions -->
    <div class="mb-12">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Mes Conventions</h2>
        <UButton 
          icon="i-heroicons-plus" 
          size="sm" 
          color="primary" 
          variant="outline" 
          label="Créer une Convention" 
          disabled
          title="Fonctionnalité à venir"
        />
      </div>

      <div v-if="conventionsLoading" class="text-center py-8">
        <p>Chargement de vos conventions...</p>
      </div>

      <div v-else-if="myConventions.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p class="text-gray-500 mb-2">Aucune convention créée</p>
        <p class="text-sm text-gray-400">Les conventions vous permettront de regrouper plusieurs éditions.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <UCard v-for="convention in myConventions" :key="convention.id" class="hover:shadow-lg transition-shadow">
          <template #header>
            <div class="flex items-center gap-3">
              <div v-if="convention.logo" class="flex-shrink-0">
                <img :src="convention.logo" :alt="convention.name" class="w-12 h-12 object-cover rounded-lg" >
              </div>
              <div v-else class="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-building-library" class="text-gray-400" size="20" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold">{{ convention.name }}</h3>
                <p class="text-xs text-gray-500">Convention</p>
              </div>
            </div>
          </template>
          
          <p v-if="convention.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {{ convention.description }}
          </p>
          <p v-else class="text-sm text-gray-400 italic">Aucune description</p>

          <template #footer>
            <div class="flex justify-between items-center">
              <p class="text-xs text-gray-500">
                Créée le {{ new Date(convention.createdAt).toLocaleDateString() }}
              </p>
              <div class="flex gap-2">
                <UButton
                  icon="i-heroicons-eye"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  disabled
                  title="Fonctionnalité à venir"
                />
                <UButton
                  icon="i-heroicons-pencil"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  disabled
                  title="Fonctionnalité à venir"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>
    </div>

    <!-- Section Éditions -->
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Mes Éditions</h2>
        <UButton 
          icon="i-heroicons-plus" 
          size="sm" 
          color="primary" 
          variant="solid" 
          label="Créer une Édition" 
          to="/editions/add"
        />
      </div>

      <div v-if="editionsLoading" class="text-center py-8">
        <p>Chargement de vos éditions...</p>
      </div>

      <div v-else-if="myEditions.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-calendar-days" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">Aucune édition créée</h3>
        <p class="text-gray-500 mb-4">Vous n'avez pas encore créé d'édition.</p>
        <UButton 
          icon="i-heroicons-plus" 
          color="primary" 
          variant="solid" 
          label="Créer ma première édition"
          to="/editions/add"
        />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard v-for="edition in myEditions" :key="edition.id">
          <template #header>
            <div class="flex items-center gap-3">
              <div v-if="edition.imageUrl" class="flex-shrink-0">
                <img :src="edition.imageUrl" :alt="edition.name" class="w-16 h-16 object-cover rounded-lg" >
              </div>
              <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-photo" class="text-gray-400" size="24" />
              </div>
              <div class="flex-1">
                <h2 class="text-xl font-semibold">{{ edition.name }}</h2>
                <UBadge :color="getStatusColor(edition)" variant="subtle" class="mt-1">
                  {{ getStatusText(edition) }}
                </UBadge>
              </div>
            </div>
          </template>
          
          <p class="text-sm text-gray-500 mb-2">Du: {{ new Date(edition.startDate).toLocaleDateString() }} au {{ new Date(edition.endDate).toLocaleDateString() }}</p>
          <p class="text-sm text-gray-500 flex items-center gap-1 mb-2">
            <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
            {{ edition.city }}, {{ edition.country }}
          </p>
          <p class="text-sm text-gray-500 flex items-center gap-1">
            <UIcon name="i-heroicons-star" class="text-gray-400" size="16" />
            {{ edition.favoritedBy.length }} favoris
          </p>

          <template #footer>
            <div class="flex justify-end space-x-2">
              <UButton
                icon="i-heroicons-eye"
                size="sm"
                color="info"
                variant="solid"
                label="Voir"
                :to="`/editions/${edition.id}`"
              />
              <UButton
                v-if="editionStore.canEditEdition(edition, authStore.user?.id || 0)"
                icon="i-heroicons-pencil"
                size="sm"
                color="warning"
                variant="solid"
                label="Modifier"
                :to="`/editions/${edition.id}/edit`"
              />
              <UButton
                v-if="editionStore.canDeleteEdition(edition, authStore.user?.id || 0)"
                icon="i-heroicons-trash"
                size="sm"
                color="error"
                variant="solid"
                label="Supprimer"
                @click="deleteEdition(edition.id)"
              />
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';
import type { Convention } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();

const editionsLoading = ref(true);
const conventionsLoading = ref(true);
const myConventions = ref<Convention[]>([]);

// Calculer les éditions de l'utilisateur
const myEditions = computed(() => {
  return editionStore.editions.filter(
    edition => edition.creatorId === authStore.user?.id
  );
});

// Déterminer le statut d'une edition
const getStatusColor = (edition: any) => {
  const now = new Date();
  const startDate = new Date(edition.startDate);
  const endDate = new Date(edition.endDate);
  
  if (now < startDate) return 'info';  // À venir
  if (now > endDate) return 'neutral';  // Passée
  return 'success';  // En cours
};

const getStatusText = (edition: any) => {
  const now = new Date();
  const startDate = new Date(edition.startDate);
  const endDate = new Date(edition.endDate);
  
  if (now < startDate) return 'À venir';
  if (now > endDate) return 'Terminée';
  return 'En cours';
};

const deleteEdition = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette édition ?')) {
    try {
      await editionStore.deleteEdition(id);
      toast.add({ 
        title: 'Édition supprimée avec succès !', 
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
    } catch (e: any) {
      toast.add({ 
        title: 'Erreur lors de la suppression', 
        description: e.statusMessage || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  }
};

// Fonction pour récupérer les conventions de l'utilisateur
const fetchMyConventions = async () => {
  try {
    conventionsLoading.value = true;
    const data = await $fetch<Convention[]>('/api/conventions/my-conventions');
    myConventions.value = data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des conventions:', error);
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de charger vos conventions',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    conventionsLoading.value = false;
  }
};

onMounted(async () => {
  // Charger les conventions et éditions en parallèle
  await Promise.all([
    fetchMyConventions(),
    (async () => {
      try {
        await editionStore.fetchEditions();
      } catch (error) {
        toast.add({ 
          title: 'Erreur', 
          description: 'Impossible de charger vos éditions',
          icon: 'i-heroicons-exclamation-triangle', 
          color: 'error' 
        });
      } finally {
        editionsLoading.value = false;
      }
    })()
  ]);
});
</script>