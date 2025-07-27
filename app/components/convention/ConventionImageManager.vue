<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-photo" class="text-primary-500" />
        <h3 class="text-lg font-semibold">Image de la convention</h3>
      </div>
    </template>
    
    <div class="space-y-4">
      <!-- Aperçu de l'image actuelle -->
      <div v-if="convention.imageUrl" class="space-y-4">
        <div class="relative inline-block">
          <img 
            :src="convention.imageUrl" 
            :alt="convention.name" 
            class="w-full max-w-md h-64 object-cover rounded-lg shadow-lg"
          />
          <UButton 
            icon="i-heroicons-trash" 
            color="red" 
            variant="solid" 
            size="sm" 
            class="absolute top-2 right-2"
            :loading="deleting"
            @click="deleteImage"
          >
            Supprimer
          </UButton>
        </div>
      </div>
      
      <!-- Zone d'upload -->
      <div v-else class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <UIcon name="i-heroicons-photo" class="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p class="text-gray-600 mb-4">Aucune image pour cette convention</p>
      </div>
      
      <!-- Bouton d'upload -->
      <div class="flex items-center gap-2">
        <UButton 
          icon="i-heroicons-arrow-up-tray" 
          variant="outline" 
          color="primary" 
          :loading="uploading"
          @click="triggerFileInput"
        >
          {{ convention.imageUrl ? 'Changer l\'image' : 'Ajouter une image' }}
        </UButton>
        
        <input 
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
        
        <p class="text-sm text-gray-500">
          Formats acceptés : JPG, PNG, GIF, WebP (max 10MB)
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useConventionStore } from '~/stores/conventions';
import type { Convention } from '~/types';

interface Props {
  convention: Convention;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'image-updated': [convention: Convention];
}>();

const authStore = useAuthStore();
const conventionStore = useConventionStore();
const toast = useToast();

const uploading = ref(false);
const deleting = ref(false);
const fileInput = ref<HTMLInputElement>();

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await $fetch(`/api/conventions/${props.convention.id}/upload-image`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    if (response.success && response.convention) {
      // Mettre à jour le store
      await conventionStore.fetchConventions();
      
      emit('image-updated', response.convention);
      
      toast.add({ 
        title: 'Image mise à jour', 
        description: 'L\'image de la convention a été changée',
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
    }
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de changer l\'image',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    uploading.value = false;
    // Reset file input
    if (target) target.value = '';
  }
};

const deleteImage = async () => {
  deleting.value = true;
  try {
    const response = await $fetch(`/api/conventions/${props.convention.id}/delete-image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    if (response.success && response.convention) {
      // Mettre à jour le store
      await conventionStore.fetchConventions();
      
      emit('image-updated', response.convention);
      
      toast.add({ 
        title: 'Image supprimée', 
        description: 'L\'image de la convention a été supprimée',
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
    }
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de supprimer l\'image',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    deleting.value = false;
  }
};
</script>