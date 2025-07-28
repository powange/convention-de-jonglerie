<template>
  <div class="max-w-4xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-pencil" class="text-warning-500" size="24" />
          <h1 class="text-2xl font-bold">Modifier la convention</h1>
        </div>
        <p v-if="convention" class="text-gray-600 mt-2">
          Modification de la convention "{{ convention.name }}"
        </p>
      </template>
      
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-4" size="24" />
        <p>Chargement des données de la convention...</p>
      </div>
      
      <div v-else-if="!convention" class="text-center py-8">
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto mb-4 text-error-500" size="24" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">Convention introuvable</h3>
        <p class="text-gray-500 mb-4">La convention que vous cherchez n'existe pas ou vous n'avez pas les droits pour la modifier.</p>
        <UButton 
          icon="i-heroicons-arrow-left" 
          variant="outline" 
          @click="router.back()"
        >
          Retour
        </UButton>
      </div>
      
      <ConventionForm 
        v-else
        :initial-data="convention"
        submit-button-text="Mettre à jour la convention" 
        :loading="updating" 
        @submit="handleUpdateConvention"
        @cancel="handleCancel"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import ConventionForm from '~/components/convention/ConventionForm.vue';
import type { Convention } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const conventionId = parseInt(route.params.id as string);
const convention = ref<Convention | null>(null);
const loading = ref(true);
const updating = ref(false);

onMounted(async () => {
  if (!authStore.token) {
    toast.add({
      title: 'Erreur d\'authentification',
      description: 'Vous devez être connecté pour modifier une convention',
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
        message: 'Vous n\'avez pas les droits pour modifier cette convention'
      };
    }
  } catch (error: any) {
    console.error('Erreur lors du chargement de la convention:', error);
    
    if (error.status === 404) {
      toast.add({
        title: 'Convention introuvable',
        description: 'La convention que vous cherchez n\'existe pas',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
    } else if (error.status === 403) {
      toast.add({
        title: 'Accès refusé',
        description: 'Vous n\'avez pas les droits pour modifier cette convention',
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

const handleUpdateConvention = async (formData: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>, file?: File | null) => {
  if (!authStore.token) {
    toast.add({
      title: 'Erreur d\'authentification',
      description: 'Vous devez être connecté pour modifier une convention',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }

  updating.value = true;

  try {
    // 1. Mettre à jour la convention
    const updatedConvention = await $fetch(`/api/conventions/${conventionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: formData,
    });

    // 2. Upload de l'image si un fichier est fourni
    let finalConvention = updatedConvention;
    if (file) {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);
      
      try {
        const uploadResponse = await $fetch(`/api/conventions/${conventionId}/upload-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
          },
          body: formDataUpload,
        });
        
        finalConvention = uploadResponse.convention;
      } catch (uploadError: any) {
        console.error('Erreur lors de l\'upload de l\'image:', uploadError);
        toast.add({
          title: 'Avertissement',
          description: 'La convention a été mise à jour mais l\'image n\'a pas pu être uploadée',
          icon: 'i-heroicons-exclamation-triangle',
          color: 'warning'
        });
      }
    }

    convention.value = finalConvention;

    toast.add({
      title: 'Convention mise à jour !',
      description: `La convention "${finalConvention.name}" a été mise à jour avec succès`,
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });

    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions');
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de la convention:', error);
    
    const errorMessage = error.data?.message || error.message || 'Une erreur est survenue lors de la mise à jour de la convention';
    
    toast.add({
      title: 'Erreur lors de la mise à jour',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  } finally {
    updating.value = false;
  }
};

const handleCancel = () => {
  router.back();
};
</script>