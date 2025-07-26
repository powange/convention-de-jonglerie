<template>
  <div>
    <div v-if="conventionStore.loading">
      <p>Chargement des détails de la convention...</p>
    </div>
    <div v-else-if="!convention">
      <p>Convention introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <ConventionHeader 
        :convention="convention" 
        current-page="covoiturage" 
        :is-favorited="isFavorited(convention.id)"
        @toggle-favorite="toggleFavorite(convention.id)"
      />
      
      <!-- Contenu du covoiturage -->
      <CarpoolSection :convention-id="convention.id" />
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
const convention = ref(null);

const isFavorited = computed(() => (conventionId: number) => {
  return convention.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
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
    convention.value = await conventionStore.fetchConventionById(conventionId);
  } catch (error) {
    console.error('Failed to fetch convention:', error);
  }
});
</script>