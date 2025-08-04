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
                <UserAvatar 
                  :user="collaborator.user" 
                  size="md"
                />
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
          <div class="space-y-3">
            <UButtonGroup>
              <UInputMenu
                v-model="selectedUser"
                v-model:search-term="searchTerm"
                :items="userItems"
                :avatar="selectedUser?.avatar"
                placeholder="Rechercher un utilisateur..."
                :loading="searchLoading"
                size="lg"
              >
                <template #option="{ option }">
                  <div class="flex items-center gap-3 w-full">
                    <UserAvatar 
                      :user="option.user" 
                      size="md"
                    />
                    <div class="flex-1 text-left">
                      <p class="text-sm font-medium">{{ option.label }}</p>
                    </div>
                  </div>
                </template>
              </UInputMenu>
            
              <div class="flex gap-2">
                <USelect 
                  v-model="newCollaboratorRole" 
                  value-key="id"  
                  :items="collaboratorRoles" 
                  :disabled="loading"
                  class="flex-1"
                />
                <UButton 
                  @click="handleAddCollaborator"
                  :disabled="!selectedUser || loading"
                  :loading="loading"
                  icon="i-heroicons-plus"
                  label="Ajouter" 
                  color="primary"
                />
              </div>
            </UButtonGroup>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Convention } from '~/types';
import type { InputMenuItem } from '@nuxt/ui';
import UserAvatar from '~/components/ui/UserAvatar.vue';

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

interface UserItem extends InputMenuItem {
  value: number;
  label: string;
  avatar?: {
    src: string;
    alt: string;
  };
  user: {
    id: number;
    pseudo: string;
    profilePicture?: string;
    emailHash?: string;
  };
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { normalizeImageUrl } = useImageUrl();
const authStore = useAuthStore();
const toast = useToast();

// État local
const selectedUser = ref<UserItem | null>(null);
const searchTerm = ref('');
const newCollaboratorRole = ref<'MODERATOR' | 'ADMINISTRATOR'>('MODERATOR');
const loading = ref(false);
const searchLoading = ref(false);
const userItems = ref<UserItem[]>([]);

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
    selectedUser.value = null;
    searchTerm.value = '';
    newCollaboratorRole.value = 'MODERATOR';
    userItems.value = [];
  }
});

// Watcher pour déclencher la recherche quand searchTerm change
watch(searchTerm, (newValue) => {
  console.log('searchTerm changed:', newValue);
  debouncedSearch(newValue);
});

// Fonction pour rechercher des utilisateurs
const searchUsers = async (query: string) => {
  console.log('Recherche d\'utilisateurs avec query:', query);
  
  if (!query || query.length < 2) {
    userItems.value = [];
    return;
  }

  try {
    searchLoading.value = true;
    const users = await $fetch<Array<{
      id: number;
      pseudo: string;
      profilePicture?: string;
      emailHash?: string;
    }>>(`/api/users/search`, {
      query: {
        q: query
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });

    console.log('Résultats de recherche:', users);

    userItems.value = users.map(user => ({
      value: user.id,
      label: user.pseudo,
      avatar: user.profilePicture ? {
        src: normalizeImageUrl(user.profilePicture),
        alt: user.pseudo
      } : undefined,
      user: user
    }));
    
    console.log('Items formatés:', userItems.value);
  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    userItems.value = [];
  } finally {
    searchLoading.value = false;
  }
};

// Debounce la recherche
let searchTimeout: NodeJS.Timeout;
const debouncedSearch = (query: string) => {
  console.log('debouncedSearch appelé avec:', query);
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchUsers(query);
  }, 300);
};

// Ajouter un collaborateur
const handleAddCollaborator = async () => {
  if (!props.convention || !selectedUser.value) return;

  try {
    loading.value = true;
    
    await $fetch(`/api/conventions/${props.convention.id}/collaborators`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: {
        userId: selectedUser.value.value,
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
    selectedUser.value = null;
    searchTerm.value = '';
    newCollaboratorRole.value = 'MODERATOR';
    userItems.value = [];
    
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