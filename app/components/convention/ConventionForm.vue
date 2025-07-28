<template>
  <UForm :state="form" :validate="validate" class="space-y-6" @submit="onSubmit">
    <!-- Nom de la convention -->
    <UFormField label="Nom de la convention" name="name" required>
      <UInput
        v-model="form.name"
        placeholder="Ex: Convention Européenne de Jonglerie"
        class="w-full"
        @blur="trimField('name')"
      />
    </UFormField>

    <!-- Description -->
    <UFormField label="Description" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Décrivez la convention, son histoire, ses spécificités..."
        :rows="4"
        class="w-full"
        @blur="trimField('description')"
      />
    </UFormField>

    <!-- Logo -->
    <UFormField label="Logo de la convention" name="logo">
      <div class="space-y-4">
        <!-- Mode upload de fichier ou URL -->
        <div class="flex gap-2">
          <UButton
            type="button"
            :variant="uploadMode === 'file' ? 'solid' : 'outline'"
            color="primary"
            size="sm"
            @click="uploadMode = 'file'"
          >
            Upload fichier
          </UButton>
          <UButton
            type="button"
            :variant="uploadMode === 'url' ? 'solid' : 'outline'"
            color="primary"
            size="sm"
            @click="uploadMode = 'url'"
          >
            URL externe
          </UButton>
        </div>

        <!-- Upload de fichier -->
        <div v-if="uploadMode === 'file'">
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            class="hidden"
            @change="handleFileSelect"
          >
          
          <div v-if="!selectedFile && !form.logo" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <UIcon name="i-heroicons-photo" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p class="text-sm text-gray-600 mb-2">Cliquez pour sélectionner une image</p>
            <UButton
              type="button"
              variant="outline"
              @click="$refs.fileInput?.click()"
            >
              Choisir un fichier
            </UButton>
            <p class="text-xs text-gray-500 mt-2">
              Formats acceptés: JPG, PNG, WEBP (max. 5MB)
            </p>
          </div>

          <div v-else-if="selectedFile" class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-document" class="text-gray-400" />
              <div class="flex-1">
                <p class="text-sm font-medium">{{ selectedFile.name }}</p>
                <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
              </div>
              <UButton
                type="button"
                variant="ghost"
                color="error"
                size="sm"
                icon="i-heroicons-trash"
                @click="removeSelectedFile"
              />
            </div>
          </div>
        </div>

        <!-- URL externe -->
        <div v-if="uploadMode === 'url'">
          <UInput
            v-model="form.logo"
            placeholder="URL du logo (optionnel)"
            class="w-full"
            @blur="trimField('logo')"
          />
          <p class="text-sm text-gray-500 mt-1">
            URL vers l'image du logo de la convention
          </p>
        </div>
      </div>
    </UFormField>

    <!-- Preview du logo -->
    <div v-if="previewUrl" class="flex justify-center">
      <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div class="flex justify-between items-center mb-2">
          <p class="text-sm text-gray-600">Aperçu du logo :</p>
          <UButton
            v-if="form.logo && initialData?.id"
            type="button"
            variant="ghost"
            color="error"
            size="xs"
            icon="i-heroicons-trash"
            @click="deleteCurrentImage"
            :loading="deletingImage"
          >
            Supprimer
          </UButton>
        </div>
        <img 
          :src="previewUrl" 
          :alt="form.name || 'Logo de la convention'" 
          class="w-24 h-24 object-cover rounded-lg mx-auto"
          @error="logoError = true"
          @load="logoError = false"
        >
        <p v-if="logoError" class="text-xs text-red-500 mt-1 text-center">
          Impossible de charger l'image
        </p>
      </div>
    </div>

    <!-- Boutons d'action -->
    <div class="flex gap-3 pt-4">
      <UButton
        type="submit"
        color="primary"
        :loading="loading"
        :disabled="loading"
      >
        {{ submitButtonText }}
      </UButton>
      
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        @click="$emit('cancel')"
      >
        Annuler
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useAuthStore } from '~/stores/auth';
import type { Convention } from '~/types';

interface Props {
  initialData?: Convention;
  submitButtonText?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  submitButtonText: 'Enregistrer',
  loading: false
});

const emit = defineEmits<{
  submit: [data: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>, file?: File | null];
  cancel: [];
}>();

const authStore = useAuthStore();
const toast = useToast();

const logoError = ref(false);
const uploadMode = ref<'file' | 'url'>('file');
const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement>();
const deletingImage = ref(false);

const form = reactive({
  name: '',
  description: '',
  logo: '',
});

// Computed pour l'aperçu de l'image
const previewUrl = computed(() => {
  if (uploadMode.value === 'file' && selectedFile.value) {
    return URL.createObjectURL(selectedFile.value);
  }
  if (uploadMode.value === 'url' && form.logo && isValidUrl(form.logo)) {
    return form.logo;
  }
  if (form.logo && !selectedFile.value) {
    return form.logo;
  }
  return null;
});

// Fonctions utilitaires
const trimField = (fieldName: keyof typeof form) => {
  if (form[fieldName] && typeof form[fieldName] === 'string') {
    form[fieldName] = form[fieldName].trim();
  }
};

const trimAllFields = () => {
  trimField('name');
  trimField('description');
  trimField('logo');
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Gestion des fichiers
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  // Vérifier le type de fichier
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    toast.add({
      title: 'Format non supporté',
      description: 'Formats acceptés: JPG, PNG, WEBP',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }
  
  // Vérifier la taille (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      title: 'Fichier trop volumineux',
      description: 'La taille maximum est de 5MB',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }
  
  selectedFile.value = file;
  form.logo = ''; // Reset l'URL si on sélectionne un fichier
};

const removeSelectedFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// Upload de l'image
const uploadImage = async (conventionId: number): Promise<string | null> => {
  if (!selectedFile.value || !authStore.token) return null;
  
  const formData = new FormData();
  formData.append('image', selectedFile.value);
  
  try {
    const response = await $fetch(`/api/conventions/${conventionId}/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: formData,
    });
    
    return response.imageUrl;
  } catch (error: any) {
    console.error('Erreur lors de l\'upload:', error);
    toast.add({
      title: 'Erreur d\'upload',
      description: error.data?.message || 'Impossible d\'uploader l\'image',
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
    return null;
  }
};

// Suppression de l'image actuelle
const deleteCurrentImage = async () => {
  if (!props.initialData?.id || !authStore.token) return;
  
  deletingImage.value = true;
  
  try {
    await $fetch(`/api/conventions/${props.initialData.id}/delete-image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    form.logo = '';
    
    toast.add({
      title: 'Image supprimée',
      description: 'L\'image a été supprimée avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Erreur lors de la suppression:', error);
    toast.add({
      title: 'Erreur de suppression',
      description: error.data?.message || 'Impossible de supprimer l\'image',
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  } finally {
    deletingImage.value = false;
  }
};

// Validation
const validate = (state: typeof form) => {
  const errors = [];
  
  if (!state.name || state.name.trim().length === 0) {
    errors.push({ path: 'name', message: 'Le nom de la convention est requis' });
  } else if (state.name.trim().length < 3) {
    errors.push({ path: 'name', message: 'Le nom doit contenir au moins 3 caractères' });
  } else if (state.name.trim().length > 100) {
    errors.push({ path: 'name', message: 'Le nom ne peut pas dépasser 100 caractères' });
  }
  
  if (state.description && state.description.length > 1000) {
    errors.push({ path: 'description', message: 'La description ne peut pas dépasser 1000 caractères' });
  }
  
  if (state.logo && state.logo.trim() && !isValidUrl(state.logo.trim())) {
    errors.push({ path: 'logo', message: 'L\'URL du logo n\'est pas valide' });
  }
  
  return errors;
};

// Soumission du formulaire
const onSubmit = async () => {
  trimAllFields();
  
  // Données du formulaire sans l'image
  const formData = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    logo: uploadMode.value === 'url' ? (form.logo.trim() || null) : (form.logo || null),
  };
  
  emit('submit', formData, uploadMode.value === 'file' ? selectedFile.value : null);
};

// Initialisation avec les données existantes
onMounted(() => {
  if (props.initialData) {
    form.name = props.initialData.name || '';
    form.description = props.initialData.description || '';
    form.logo = props.initialData.logo || '';
  }
});
</script>