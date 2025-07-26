<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold">Modifier la convention</h1>
    </template>
    <div v-if="conventionStore.loading">
      <p>Chargement des données de la convention...</p>
    </div>
    <div v-else-if="!convention">
      <p>Convention introuvable.</p>
    </div>
    <ConventionForm v-else :initial-data="convention" @submit="handleUpdateConvention" submit-button-text="Mettre à jour la convention" :loading="conventionStore.loading" />
  </UCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useConventionStore } from '~/stores/conventions';
import { useRouter } from 'vue-router';
import ConventionForm from '~/components/ConventionForm.vue';
import type { Convention } from '~/types';
import { useAuthStore } from '~/stores/auth';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const conventionStore = useConventionStore();
const authStore = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const conventionId = parseInt(route.params.id as string);
const convention = ref(null);

onMounted(async () => {
  try {
    // Récupérer la convention spécifique
    const foundConvention = await conventionStore.fetchConventionById(conventionId);
    
    // Vérifier que l'utilisateur peut modifier cette convention
    if (!conventionStore.canEditConvention(foundConvention, authStore.user?.id || 0)) {
      toast.add({ 
        title: 'Accès refusé', 
        description: 'Vous n\'avez pas les droits pour modifier cette convention',
        icon: 'i-heroicons-exclamation-triangle', 
        color: 'error' 
      });
      router.push('/');
      return;
    }
    
    convention.value = foundConvention;
  } catch (error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Convention introuvable',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
    router.push('/');
  }
});

const handleUpdateConvention = async (formData: Convention) => {
  try {
    await conventionStore.updateConvention(conventionId, formData);
    toast.add({ title: 'Convention mise à jour avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push('/');
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour de la convention', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};
</script>