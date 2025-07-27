<template>
  <div>
    <div v-if="conventionStore.loading">
      <p>Chargement des détails de la convention...</p>
    </div>
    <div v-else-if="!edition">
      <p>Convention introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <ConventionHeader 
        :convention="edition" 
        current-page="covoiturage" 
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />
      
      <!-- Contenu du covoiturage -->
      <CarpoolSection :convention-id="edition.id" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useConventionStore } from '~/stores/conventions';
import { useAuthStore } from '~/stores/auth';
import CarpoolSection from '~/components/convention/CarpoolSection.vue';
import ConventionHeader from '~/components/convention/ConventionHeader.vue';

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-client'
// });

const route = useRoute();
const conventionStore = useConventionStore();
const authStore = useAuthStore();
const toast = useToast();

const conventionId = parseInt(route.params.id as string);
const edition = ref(null);

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    // Recharger la convention pour mettre à jour l'état des favoris
    edition.value = await conventionStore.fetchConventionById(conventionId);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

onMounted(async () => {
  // Vérifier l'authentification
  if (!authStore.isAuthenticated) {
    await navigateTo(`/login?returnTo=${encodeURIComponent(route.fullPath)}`);
    return;
  }
  
  try {
    edition.value = await conventionStore.fetchConventionById(conventionId);
  } catch (error) {
    console.error('Failed to fetch convention:', error);
  }
});
</script>