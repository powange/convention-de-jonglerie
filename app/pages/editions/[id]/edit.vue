<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Modifier l'édition</h1>
      </template>
      <div v-if="editionStore.loading">
        <p>Chargement des données de l'édition...</p>
      </div>
      <div v-else-if="!edition">
        <p>Édition introuvable.</p>
      </div>
      <EditionForm v-else :initial-data="edition" submit-button-text="Mettre à jour l'édition" :loading="editionStore.loading" @submit="handleUpdateConvention" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEditionStore } from '~/stores/editions';
import { useRouter } from 'vue-router';
import EditionForm from '~/components/edition/EditionForm.vue';
import type { Edition } from '~/types';
import { useAuthStore } from '~/stores/auth';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const conventionId = parseInt(route.params.id as string);
const edition = ref(null);

onMounted(async () => {
  try {
    // Récupérer l'édition spécifique
    const foundEdition = await editionStore.fetchEditionById(conventionId);
    
    // Vérifier que l'utilisateur peut modifier cette édition
    if (!editionStore.canEditEdition(foundEdition, authStore.user?.id || 0)) {
      toast.add({ 
        title: 'Accès refusé', 
        description: 'Vous n\'avez pas les droits pour modifier cette édition',
        icon: 'i-heroicons-exclamation-triangle', 
        color: 'error' 
      });
      router.push('/');
      return;
    }
    
    edition.value = foundEdition;
  } catch (_error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Édition introuvable',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
    router.push('/');
  }
});

const handleUpdateConvention = async (formData: Edition) => {
  try {
    await editionStore.updateEdition(conventionId, formData);
    toast.add({ title: 'Édition mise à jour avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push(`/editions/${conventionId}`);
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour de l\'édition', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};
</script>