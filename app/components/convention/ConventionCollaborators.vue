<template>
  <UCard>
    <template #header>
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">{{ $t('conventions.collaborators') }}</h3>
        <UButton 
          icon="i-heroicons-user-plus" 
          size="sm" 
          :disabled="!isCreator"
          @click="showAddModal = true"
        >
          Ajouter
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="text-center py-4">
      <p>Chargement des collaborateurs...</p>
    </div>

    <div v-else-if="collaborators.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-users" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
      <p class="text-gray-500">Aucun collaborateur</p>
      <p class="text-sm text-gray-400">Ajoutez des collaborateurs pour qu'ils puissent modifier cette convention</p>
    </div>

    <div v-else class="space-y-3">
      <div v-for="collaborator in collaborators" :key="collaborator.id" class="flex items-center justify-between p-3 border rounded-lg">
        <div class="flex items-center gap-3">
          <UserAvatar
            :user="collaborator.user"
            size="lg"
            border
          />
          <div>
            <p class="font-medium">{{ collaborator.user.pseudo }}</p>
            <p class="text-sm text-gray-500">{{ collaborator.user.prenom }} {{ collaborator.user.nom }}</p>
            <p class="text-xs text-gray-400">
              Ajouté par {{ collaborator.addedBy.pseudo }} le {{ new Date(collaborator.addedAt).toLocaleDateString() }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge :color="collaborator.canEdit ? 'success' : 'neutral'" variant="subtle">
            {{ collaborator.canEdit ? 'Peut modifier' : 'Lecture seule' }}
          </UBadge>
          <UButton 
            v-if="isCreator"
            icon="i-heroicons-trash" 
            size="sm" 
            color="error" 
            variant="ghost"
            @click="removeCollaborator(collaborator)"
          />
        </div>
      </div>
    </div>

    <!-- Modal d'ajout de collaborateur -->
    <UModal v-model="showAddModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Ajouter un collaborateur</h3>
        </template>
        
        <UForm :state="addForm" :schema="addSchema" class="space-y-4" @submit="addCollaborator">
          <UFormField :label="t('common.email')" name="userEmail">
            <UInput v-model="addForm.userEmail" type="email" required placeholder="email@example.com" />
          </UFormField>
          
          <UFormField :label="t('components.collaborators_modal.permissions')" name="canEdit">
            <UCheckbox v-model="addForm.canEdit" :label="t('components.collaborators_modal.allow_modification')" />
            <p class="text-xs text-gray-500 mt-1">
              Les collaborateurs peuvent modifier la convention mais pas la supprimer
            </p>
          </UFormField>
          
          <div class="flex justify-end space-x-2">
            <UButton 
              type="button" 
              variant="ghost" 
              @click="showAddModal = false"
            >
              Annuler
            </UButton>
            <UButton 
              type="submit" 
              :loading="adding"
              color="primary"
            >
              Ajouter
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { z } from 'zod';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import type { ConventionCollaborator } from '~/types';
import UserAvatar from '~/components/ui/UserAvatar.vue';

interface Props {
  conventionId: number;
  creatorId: number;
}

const props = defineProps<Props>();

const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const { t } = useI18n();

const loading = ref(true);
const adding = ref(false);
const showAddModal = ref(false);
const collaborators = ref<ConventionCollaborator[]>([]);

// Vérifier si l'utilisateur est le créateur
const isCreator = computed(() => {
  return authStore.user?.id === props.creatorId;
});

// Schéma de validation pour l'ajout
const addSchema = z.object({
  userEmail: z.string().email(t('errors.invalid_email')),
  canEdit: z.boolean().default(true)
});

// Formulaire d'ajout
const addForm = reactive({
  userEmail: '',
  canEdit: true
});

const resetForm = () => {
  addForm.userEmail = '';
  addForm.canEdit = true;
};

const loadCollaborators = async () => {
  if (!isCreator.value) return;
  
  loading.value = true;
  try {
    collaborators.value = await editionStore.getCollaborators(props.conventionId);
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger les collaborateurs',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red'
    });
  } finally {
    loading.value = false;
  }
};

const addCollaborator = async () => {
  adding.value = true;
  try {
    const newCollaborator = await editionStore.addCollaborator(
      props.conventionId,
      addForm.userEmail,
      addForm.canEdit
    );
    
    collaborators.value.push(newCollaborator);
    showAddModal.value = false;
    resetForm();
    
    toast.add({
      title: 'Collaborateur ajouté',
      description: `${newCollaborator.user.pseudo} peut maintenant modifier cette convention`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    });
  } catch (error: unknown) {
    const errorMessage = (error && typeof error === 'object' && 'statusMessage' in error && typeof error.statusMessage === 'string') 
                        ? error.statusMessage 
                        : 'Impossible d\'ajouter le collaborateur';
    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    });
  } finally {
    adding.value = false;
  }
};

const removeCollaborator = async (collaborator: ConventionCollaborator) => {
  if (!confirm(`Retirer ${collaborator.user.pseudo} des collaborateurs ?`)) {
    return;
  }
  
  try {
    await editionStore.removeCollaborator(props.conventionId, collaborator.id);
    collaborators.value = collaborators.value.filter(c => c.id !== collaborator.id);
    
    toast.add({
      title: 'Collaborateur retiré',
      description: `${collaborator.user.pseudo} ne peut plus modifier cette convention`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    });
  } catch (error: unknown) {
    const errorMessage = (error && typeof error === 'object' && 'statusMessage' in error && typeof error.statusMessage === 'string') 
                        ? error.statusMessage 
                        : 'Impossible de retirer le collaborateur';
    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    });
  }
};

onMounted(() => {
  loadCollaborators();
});
</script>