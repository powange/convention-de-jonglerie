<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">{{ $t('navigation.my_favorites') }}</h1>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        size="md" 
        color="primary" 
        variant="outline" 
        :label="t('navigation.discover_editions')" 
        to="/"
      />
    </div>

    <div v-if="loading" class="text-center py-8">
      <p>{{ $t('navigation.loading_favorites') }}</p>
    </div>

    <div v-else-if="favoriteEditions.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-star" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('navigation.no_favorites') }}</h3>
      <p class="text-gray-500 mb-4">{{ $t('pages.favorites.no_favorites_added') }}</p>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        color="primary" 
        variant="solid" 
        :label="t('navigation.discover_editions')"
        to="/"
      />
    </div>

    <div v-else>
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <p class="text-gray-600 mb-4 lg:mb-0">
          {{ favoriteEditions.length }} {{ $t('pages.favorites.editions_in_favorites', { count: favoriteEditions.length }) }}
          <span v-if="favoriteEditions.length > itemsPerPage" class="ml-2">
            (Page {{ currentPage }} sur {{ Math.ceil(favoriteEditions.length / itemsPerPage) }})
          </span>
        </p>
        
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
      <div v-if="viewMode === 'grid'">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditionCard 
            v-for="edition in paginatedFavoriteEditions" 
            :key="edition.id" 
            :edition="edition"
            show-status
          >
      <template #actions="{ edition: ed }">
            <UButton
              icon="i-heroicons-star-solid"
              color="warning"
              variant="ghost"
              size="sm"
        :title="$t('common.favorite')"
        @click="removeFavorite(ed.id)"
            />
          </template>
        </EditionCard>
      </div>
      
      <!-- Pagination -->
      <div v-if="favoriteEditions.length > itemsPerPage" class="mt-8 flex justify-center">
        <UPagination 
          v-model:page="currentPage"
          :total="favoriteEditions.length"
          :items-per-page="itemsPerPage"
          :sibling-count="1"
          :show-edges="true"
          size="md"
        />
      </div>
    </div>

      <!-- Vue en carte -->
      <div v-else-if="viewMode === 'map'">
        <FavoritesMap :editions="favoriteEditions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';

// Lazy loading du composant FavoritesMap
const FavoritesMap = defineAsyncComponent(() => import('~/components/FavoritesMap.vue'));

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();
const { t } = useI18n();

const loading = ref(true);
const viewMode = ref<'grid' | 'map'>('grid');

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(12);

// Calculer les éditions favorites de l'utilisateur triées par date de début
const favoriteEditions = computed(() => {
  return editionStore.editions
    .filter(edition => edition.favoritedBy.some(user => user.id === authStore.user?.id))
    .sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime(); // Tri croissant (plus proche en premier)
    });
});

// Éditions favorites paginées
const paginatedFavoriteEditions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return favoriteEditions.value.slice(start, end);
});


const removeFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ 
      title: t('messages.removed_from_favorites'), 
      icon: 'i-heroicons-star', 
      color: 'warning' 
    });
  } catch {
    toast.add({ 
      title: t('common.error'), 
      description: t('errors.cannot_remove_favorite'),
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  }
};

onMounted(async () => {
  try {
    // Charger toutes les éditions pour filtrer les favoris côté client
    // Note: Pour les favoris, on charge toutes les pages car le filtrage se fait côté client
    await editionStore.fetchEditions({ limit: 1000 });
  } catch {
    toast.add({ 
      title: t('common.error'), 
      description: t('errors.cannot_load_editions'),
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
});
</script>