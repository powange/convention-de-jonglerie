<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
import { onMounted, computed } from 'vue';
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
const { t } = useI18n();

const editionId = parseInt(route.params.id as string);
const edition = computed(() => editionStore.getEditionById(editionId));

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy?.some(u => u.id === authStore.user?.id) || false;
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ title: t('messages.favorite_status_updated'), icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    const title = e && typeof e === 'object' && 'statusMessage' in e && typeof (e as any).statusMessage === 'string'
      ? (e as any).statusMessage
      : t('errors.favorite_update_failed')
    toast.add({ title, icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId);
    } catch (error) {
      console.error('Failed to fetch edition:', error);
    }
  }
});
</script>