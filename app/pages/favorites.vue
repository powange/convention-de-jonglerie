<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Mes Favoris</h1>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        size="md" 
        color="primary" 
        variant="outline" 
        label="Découvrir des éditions" 
        to="/"
      />
    </div>

    <div v-if="loading" class="text-center py-8">
      <p>Chargement de vos favoris...</p>
    </div>

    <div v-else-if="favoriteEditions.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-star" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">Aucun favori</h3>
      <p class="text-gray-500 mb-4">Vous n'avez pas encore ajouté d'édition à vos favoris.</p>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        color="primary" 
        variant="solid" 
        label="Découvrir des éditions"
        to="/"
      />
    </div>

    <div v-else>
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <p class="text-gray-600 mb-4 lg:mb-0">{{ favoriteEditions.length }} édition{{ favoriteEditions.length > 1 ? 's' : '' }} en favoris</p>
        
        <!-- Boutons de vue -->
        <div class="flex gap-2">
          <UButton
            :color="viewMode === 'grid' ? 'primary' : 'neutral'"
            :variant="viewMode === 'grid' ? 'solid' : 'ghost'"
            icon="i-heroicons-squares-2x2"
            size="sm"
            @click="viewMode = 'grid'"
          >
            Grille
          </UButton>
          <UButton
            :color="viewMode === 'map' ? 'primary' : 'neutral'"
            :variant="viewMode === 'map' ? 'solid' : 'ghost'"
            icon="i-heroicons-map"
            size="sm"
            @click="viewMode = 'map'"
          >
            Carte
          </UButton>
        </div>
      </div>

      <!-- Vue en grille (par défaut) -->
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <EditionCard 
          v-for="edition in favoriteEditions" 
          :key="edition.id" 
          :edition="edition"
          show-status
        >
          <template #actions="{ edition }">
            <UButton
              icon="i-heroicons-star-solid"
              color="warning"
              variant="ghost"
              size="sm"
              title="Retirer des favoris"
              @click="removeFavorite(edition.id)"
            />
          </template>
        </EditionCard>
      </div>

      <!-- Vue en carte -->
      <div v-else-if="viewMode === 'map'">
        <FavoritesMap :editions="favoriteEditions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();

const loading = ref(true);
const viewMode = ref<'grid' | 'map'>('grid');

// Calculer les éditions favorites de l'utilisateur
const favoriteEditions = computed(() => {
  return editionStore.editions.filter(
    edition => edition.favoritedBy.some(user => user.id === authStore.user?.id)
  );
});


const removeFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ 
      title: 'Retiré des favoris', 
      icon: 'i-heroicons-star', 
      color: 'warning' 
    });
  } catch (_e: unknown) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de retirer des favoris',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  }
};

onMounted(async () => {
  try {
    await editionStore.fetchEditions();
  } catch (_error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de charger les éditions',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
});
</script>