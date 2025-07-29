<template>
  <div>
    <div v-if="editionStore.loading">
      <p>Chargement des détails de l'édition...</p>
    </div>
    <div v-else-if="!edition">
      <p>Édition introuvable.</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert 
        icon="i-heroicons-exclamation-triangle" 
        color="red" 
        variant="soft"
        title="Accès refusé"
        description="Vous n'avez pas les permissions pour accéder à cette page."
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader 
        :edition="edition" 
        current-page="gestion" 
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />
      
      <!-- Contenu de gestion -->
      <div class="space-y-6">
        <UCard>
        <!-- Actions de gestion -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Actions</h3>
          <div class="flex gap-2">
            <UButton
              v-if="canEdit"
              icon="i-heroicons-pencil"
              color="warning"
              :to="`/editions/${edition.id}/edit`"
            >
              Modifier l'édition
            </UButton>
            <UButton
              v-if="canDelete"
              icon="i-heroicons-trash"
              color="error"
              variant="soft"
              @click="deleteEdition(edition.id)"
            >
              Supprimer l'édition
            </UButton>
          </div>
        </div>
      </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import EditionHeader from '~/components/edition/EditionHeader.vue';

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-client'
// });

const route = useRoute();
const router = useRouter();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();

const editionId = parseInt(route.params.id as string);
const edition = ref(null);

onMounted(async () => {
  try {
    edition.value = await editionStore.fetchEditionById(editionId);
  } catch (error) {
    console.error('Failed to fetch edition:', error);
  }
});

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false;
  return canEdit.value || authStore.user?.id === edition.value?.creatorId;
});

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false;
  return editionStore.canEditEdition(edition.value, authStore.user.id);
});

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false;
  return editionStore.canDeleteEdition(edition.value, authStore.user.id);
});

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    // Recharger l'édition pour mettre à jour l'état des favoris
    edition.value = await editionStore.fetchEditionById(editionId);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

const deleteEdition = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette édition ?')) {
    try {
      await editionStore.deleteEdition(id);
      toast.add({ title: 'Édition supprimée avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
      router.push('/');
    } catch (e: unknown) {
      toast.add({ title: e.statusMessage || 'Échec de la suppression de l\'édition', icon: 'i-heroicons-x-circle', color: 'error' });
    }
  }
};
</script>