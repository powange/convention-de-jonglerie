<template>
  <div class="max-w-4xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-building-library" class="text-primary-500" size="24" />
          <h1 class="text-2xl font-bold">Créer une nouvelle convention</h1>
        </div>
        <p class="text-gray-600 mt-2">
          Une convention regroupe plusieurs éditions d'un même événement de jonglerie.
        </p>
      </template>
      
      <ConventionForm 
        submit-button-text="Créer la convention" 
        :loading="loading" 
        @submit="handleAddConvention"
        @cancel="handleCancel"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import ConventionForm from '~/components/convention/ConventionForm.vue';
import type { Convention, ConventionFormData, HttpError } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);

const handleAddConvention = async (formData: ConventionFormData, file?: File | null) => {
  if (!authStore.token) {
    toast.add({
      title: 'Erreur d\'authentification',
      description: 'Vous devez être connecté pour créer une convention',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    // 1. Créer la convention
    const convention = await $fetch('/api/conventions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: formData,
    });

    // 2. Upload de l'image si un fichier est fourni
    let finalConvention = convention;
    if (file) {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);
      
      try {
        const uploadResponse = await $fetch(`/api/conventions/${convention.id}/upload-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
          },
          body: formDataUpload,
        });
        
        finalConvention = uploadResponse.convention;
      } catch (uploadError: unknown) {
        console.error('Erreur lors de l\'upload de l\'image:', uploadError);
        toast.add({
          title: 'Avertissement',
          description: 'La convention a été créée mais l\'image n\'a pas pu être uploadée',
          icon: 'i-heroicons-exclamation-triangle',
          color: 'warning'
        });
      }
    }

    toast.add({
      title: 'Convention créée !',
      description: `La convention "${finalConvention.name}" a été créée avec succès`,
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });

    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions');
  } catch (error: unknown) {
    console.error('Erreur lors de la création de la convention:', error);
    
    const httpError = error as HttpError;
    const errorMessage = httpError.data?.message || httpError.message || 'Une erreur est survenue lors de la création de la convention';
    
    toast.add({
      title: 'Erreur lors de la création',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.back();
};
</script>