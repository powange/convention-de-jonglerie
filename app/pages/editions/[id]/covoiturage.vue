<template>
  <div>
    <div v-if="editionStore.loading">
      <p>Chargement des détails de l'édition...</p>
    </div>
    <div v-else-if="!edition">
      <p>Édition introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader 
        :edition="edition" 
        current-page="covoiturage" 
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />
      
      <!-- Contenu du covoiturage -->
      <CarpoolSection :edition-id="edition.id" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import CarpoolSection from '~/components/edition/CarpoolSection.vue';
import EditionHeader from '~/components/edition/EditionHeader.vue';

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-protected'
// });

const route = useRoute();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();

const editionId = parseInt(route.params.id as string);
const edition = ref(null);

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy?.some(u => u.id === authStore.user?.id) || false;
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    // Recharger l'édition pour mettre à jour l'état des favoris
    edition.value = await editionStore.fetchEditionById(editionId);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

onMounted(async () => {
  try {
    edition.value = await editionStore.fetchEditionById(editionId);
  } catch (error) {
    console.error('Failed to fetch edition:', error);
  }
});
</script>