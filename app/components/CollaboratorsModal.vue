<template>
  <UModal v-model:open="isOpen" title="Gérer les collaborateurs" close-icon="i-heroicons-x-mark-20-solid">
    <template #body>
      <div class="space-y-6">
        <!-- Notice de développement -->
        <div class="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <UIcon name="i-heroicons-wrench-screwdriver" class="text-amber-600 dark:text-amber-400 flex-shrink-0" size="18" />
          <p class="text-sm text-amber-800 dark:text-amber-200">
            <strong>En cours de développement :</strong> Cette fonctionnalité est actuellement en cours d'amélioration.
          </p>
        </div>

        <!-- Texte explicatif -->
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-information-circle" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size="20" />
            <div class="space-y-2">
              <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">
                À propos des collaborateurs
              </h4>
              <p class="text-sm text-blue-800 dark:text-blue-200">
                Les collaborateurs peuvent vous aider à gérer vos conventions. Vous pouvez leur attribuer différents rôles :
              </p>
              <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>• <strong>Modérateur :</strong> Peut gérer les éditions de la convention</li>
                <li>• <strong>Administrateur :</strong> Peut gérer la convention, les éditions, ajouter/supprimer des collaborateurs</li>
              </ul>
            </div>
          </div>
        </div>
        <!-- Liste des collaborateurs existants -->
        <div v-if="convention?.collaborators && convention.collaborators.length > 0">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Collaborateurs actuels
          </h4>
          <div class="space-y-2">
            <div 
              v-for="collaborator in convention.collaborators" 
              :key="collaborator.id"
              class="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div v-if="collaborator.user.profilePicture" class="flex-shrink-0">
                  <img 
                    :src="normalizeImageUrl(collaborator.user.profilePicture)" 
                    :alt="collaborator.user.pseudo" 
                    class="w-8 h-8 object-cover rounded-full" 
                  >
                </div>
                <div v-else class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <UIcon name="i-heroicons-user" class="text-gray-500 dark:text-gray-400" size="16" />
                </div>
                <div>
                  <p class="text-sm font-medium">{{ collaborator.user.pseudo }}</p>
                </div>
                <UBadge 
                  :color="collaborator.role === 'ADMINISTRATOR' ? 'warning' : 'info'"
                  variant="subtle"
                  size="sm"
                >
                  {{ collaborator.role === 'ADMINISTRATOR' ? 'Admin' : 'Modo' }}
                </UBadge>
              </div>
              <UButton
                v-if="collaborator.user.id !== currentUserId"
                icon="i-heroicons-trash"
                size="xs"
                color="error"
                variant="ghost"
                @click="handleRemoveCollaborator(collaborator.id)"
              />
            </div>
          </div>
        </div>

        <!-- Formulaire d'ajout -->
        <div>
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Ajouter un collaborateur
          </h4>
          <UButtonGroup>
            <UInput 
              v-model="newCollaboratorEmail" 
              placeholder="Email ou pseudo de l'utilisateur"
              :disabled="loading"
            />
            <USelect 
              v-model="newCollaboratorRole" 
              value-key="id"  
              :items="collaboratorRoles" 
              :disabled="loading"
            />
            <UButton 
              @click="handleAddCollaborator"
              :disabled="!newCollaboratorEmail.trim() || loading"
              :loading="loading"
              label="Ajouter" 
              color="primary"
            />
          </UButtonGroup>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Convention } from '~/types';

interface Props {
  modelValue: boolean;
  convention: Convention | null;
  currentUserId?: number;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'collaborator-added'): void;
  (e: 'collaborator-removed'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { normalizeImageUrl } = useImageUrl();
const authStore = useAuthStore();
const toast = useToast();

// État local
const newCollaboratorEmail = ref('');
const newCollaboratorRole = ref<'MODERATOR' | 'ADMINISTRATOR'>('MODERATOR');
const loading = ref(false);

// Rôles des collaborateurs
const collaboratorRoles = [
  {
    label: 'Modérateur',
    id: 'MODERATOR'
  },
  {
    label: 'Administrateur',
    id: 'ADMINISTRATOR'
  }
];

// Computed pour gérer l'état de la modal
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

// Réinitialiser le formulaire quand la modal s'ouvre
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    newCollaboratorEmail.value = '';
    newCollaboratorRole.value = 'MODERATOR';
  }
});

// Ajouter un collaborateur
const handleAddCollaborator = async () => {
  if (!props.convention || !newCollaboratorEmail.value.trim()) return;

  try {
    loading.value = true;
    
    await $fetch(`/api/conventions/${props.convention.id}/collaborators`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: {
        userIdentifier: newCollaboratorEmail.value.trim(),
        role: newCollaboratorRole.value,
      },
    });

    toast.add({
      title: 'Collaborateur ajouté',
      description: 'Le collaborateur a été ajouté avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });

    // Réinitialiser le formulaire
    newCollaboratorEmail.value = '';
    newCollaboratorRole.value = 'MODERATOR';
    
    // Émettre l'événement pour recharger les données
    emit('collaborator-added');
    
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: 'Erreur lors de l\'ajout',
      description: httpError.data?.message || httpError.message || 'Une erreur est survenue',
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
};

// Supprimer un collaborateur
const handleRemoveCollaborator = async (collaboratorId: number) => {
  if (!props.convention) return;

  if (confirm('Êtes-vous sûr de vouloir retirer ce collaborateur ?')) {
    try {
      await $fetch(`/api/conventions/${props.convention.id}/collaborators/${collaboratorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
        },
      });

      toast.add({
        title: 'Collaborateur retiré',
        description: 'Le collaborateur a été retiré avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      });

      // Émettre l'événement pour recharger les données
      emit('collaborator-removed');
      
    } catch (error: unknown) {
      const httpError = error as { data?: { message?: string }; message?: string };
      toast.add({
        title: 'Erreur lors du retrait',
        description: httpError.data?.message || httpError.message || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle',
        color: 'error'
      });
    }
  }
};
</script>