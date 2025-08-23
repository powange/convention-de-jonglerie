<template>
  <div class="max-w-4xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-pencil" class="text-warning-500" size="24" />
          <h1 class="text-2xl font-bold">{{ $t('conventions.edit') }}</h1>
        </div>
        <p v-if="convention" class="text-gray-600 mt-2">
          {{ $t('pages.edit_convention.editing_convention', { name: convention.name }) }}
        </p>
      </template>
      
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-4" size="24" />
        <p>{{ $t('pages.edit_convention.loading_convention_data') }}</p>
      </div>
      
      <div v-else-if="!convention" class="text-center py-8">
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto mb-4 text-error-500" size="24" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('conventions.convention_not_found') }}</h3>
        <p class="text-gray-500 mb-4">{{ $t('pages.edit_convention.convention_not_found_or_no_rights') }}</p>
        <UButton 
          icon="i-heroicons-arrow-left" 
          variant="outline" 
          @click="router.back()"
        >
          {{ $t('common.back') }}
        </UButton>
      </div>
      
      <ConventionForm 
        v-else
        :initial-data="convention"
        :submit-button-text="$t('pages.edit_convention.submit_button')" 
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
  middleware: 'auth-protected'
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const { t } = useI18n();

const conventionId = parseInt(route.params.id as string);
const convention = ref<Convention | null>(null);
const loading = ref(true);
const updating = ref(false);

onMounted(async () => {
  // La protection est gérée côté serveur par session et par middleware 'auth-protected'.

  try {
    convention.value = await $fetch(`/api/conventions/${conventionId}`);
    
    // Vérifier droits : auteur ou collaborateur avec droit editConvention
    const isAuthor = convention.value.authorId === authStore.user?.id;
    const hasEditRight = convention.value.collaborators?.some(
      collab => collab.user.id === authStore.user?.id && collab.rights?.editConvention
    );

    if (!isAuthor && !hasEditRight) {
      throw {
        status: 403,
        message: 'Vous n\'avez pas les droits pour modifier cette convention'
      };
    }
  } catch (error: unknown) {
    console.error('Erreur lors du chargement de la convention:', error);
    
    const errorStatus = (error && typeof error === 'object' && 'status' in error) ? error.status : null;
    
    if (errorStatus === 404) {
      toast.add({
        title: t('conventions.convention_not_found'),
        description: t('conventions.convention_not_found_description'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'red'
      });
    } else if (errorStatus === 403) {
      toast.add({
        title: t('pages.access_denied.title'),
        description: t('errors.convention_edit_denied'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'red'
      });
    } else {
      toast.add({
        title: t('errors.loading_error'),
        description: t('errors.cannot_load_convention'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'red'
      });
    }
  } finally {
    loading.value = false;
  }
});

const handleUpdateConvention = async (formData: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>) => {

  updating.value = true;

  try {
    // Mettre à jour la convention (l'upload d'image se fait automatiquement via ImageUpload)
    const updatedConvention = await $fetch(`/api/conventions/${conventionId}`, {
      method: 'PUT',
      body: formData,
    });

    convention.value = updatedConvention;

    toast.add({
      title: t('messages.convention_updated'),
      description: t('messages.convention_updated_desc', { name: updatedConvention.name }),
      icon: 'i-heroicons-check-circle',
  color: 'success'
    });

    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions');
  } catch (error: unknown) {
    console.error('Error updating convention:', error);
    
    let errorMessage = t('errors.convention_update_error');
    if (error && typeof error === 'object') {
      if ('data' in error && error.data && typeof error.data === 'object' && 'message' in error.data) {
        errorMessage = String(error.data.message);
      } else if ('message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
    }
    
    toast.add({
      title: t('errors.update_error'),
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