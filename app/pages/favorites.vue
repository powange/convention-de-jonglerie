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
      <p class="text-gray-600 mb-4">{{ favoriteEditions.length }} édition{{ favoriteEditions.length > 1 ? 's' : '' }} en favoris</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();

const loading = ref(true);

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