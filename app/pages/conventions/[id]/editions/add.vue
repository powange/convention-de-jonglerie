<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-calendar-days" class="text-primary-500" size="24" />
          <h1 class="text-2xl font-bold">Ajouter une nouvelle édition</h1>
        </div>
        <p v-if="convention" class="text-gray-600 mt-2">
          Pour la convention "{{ convention.name }}"
        </p>
      </template>
      
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-4" size="24" />
        <p>Chargement des données de la convention...</p>
      </div>
      
      <div v-else-if="!convention" class="text-center py-8">
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto mb-4 text-error-500" size="24" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">Convention introuvable</h3>
        <p class="text-gray-500 mb-4">La convention que vous cherchez n'existe pas ou vous n'avez pas les droits pour y ajouter une édition.</p>
        <UButton 
          icon="i-heroicons-arrow-left" 
          variant="outline" 
          @click="router.back()"
        >
          Retour
        </UButton>
      </div>
      
      <EditionForm 
        v-else
        :initial-data="{ conventionId: convention.id }"
        submit-button-text="Créer l'édition" 
        :loading="submitting" 
        @submit="handleAddEdition" 
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';
import EditionForm from '~/components/edition/EditionForm.vue';
import type { Convention, EditionFormData, HttpError } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();

const conventionId = parseInt(route.params.id as string);
const convention = ref<Convention | null>(null);
const loading = ref(true);
const submitting = ref(false);

onMounted(async () => {
  if (!authStore.token) {
    toast.add({
      title: 'Erreur d\'authentification',
      description: 'Vous devez être connecté pour ajouter une édition',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    router.push('/login');
    return;
  }

  try {
    convention.value = await $fetch(`/api/conventions/${conventionId}`);
    
    // Vérifier que l'utilisateur est l'auteur de la convention
    if (convention.value.authorId !== authStore.user?.id) {
      throw {
        status: 403,
        message: 'Vous n\'avez pas les droits pour ajouter une édition à cette convention'
      };
    }
  } catch (error: unknown) {
    console.error('Erreur lors du chargement de la convention:', error);
    
    const httpError = error as HttpError;
    if (httpError.status === 404) {
      toast.add({
        title: 'Convention introuvable',
        description: 'La convention que vous cherchez n\'existe pas',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
    } else if (httpError.status === 403) {
      toast.add({
        title: 'Accès refusé',
        description: 'Vous n\'avez pas les droits pour ajouter une édition à cette convention',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
    } else {
      toast.add({
        title: 'Erreur de chargement',
        description: 'Impossible de charger les données de la convention',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
    }
  } finally {
    loading.value = false;
  }
});

const handleAddEdition = async (data: EditionFormData) => {
  submitting.value = true;
  
  try {
    await editionStore.addEdition(data);
    
    toast.add({
      title: 'Édition créée !',
      description: 'L\'édition a été créée avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });
    
    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions');
  } catch (error: unknown) {
    console.error('Erreur lors de la création de l\'édition:', error);
    
    const httpError = error as HttpError;
    const errorMessage = httpError.data?.message || httpError.message || 'Une erreur est survenue lors de la création de l\'édition';
    
    toast.add({
      title: 'Erreur lors de la création',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  } finally {
    submitting.value = false;
  }
};
</script>