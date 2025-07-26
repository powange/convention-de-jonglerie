<template>
  <div>
    <div v-if="conventionStore.loading">
      <p>Chargement des détails de la convention...</p>
    </div>
    <div v-else-if="!convention">
      <p>Convention introuvable.</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert 
        icon="i-heroicons-exclamation-triangle" 
        color="red" 
        variant="soft"
        title="Accès refusé"
        description="Vous n'avez pas les permissions pour accéder à cette page."
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <ConventionHeader 
        :convention="convention" 
        current-page="gestion" 
        :is-favorited="isFavorited(convention.id)"
        @toggle-favorite="toggleFavorite(convention.id)"
      />
      
      <!-- Contenu de gestion -->
      <UCard>
        <div class="space-y-6">
          <!-- Section collaborateurs -->
          <div v-if="authStore.user?.id === convention.creatorId">
            <h3 class="text-lg font-semibold mb-4">Gestion des collaborateurs</h3>
            <p class="text-gray-500">La gestion des collaborateurs sera disponible prochainement.</p>
            <!-- TODO: Réactiver ConventionCollaborators une fois l'API corrigée -->
            <!-- <ConventionCollaborators 
              :convention-id="convention.id" 
              :creator-id="convention.creatorId" 
            /> -->
          </div>

          <!-- Actions de gestion -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Actions</h3>
            <div class="flex gap-2">
              <UButton
                v-if="canEdit"
                icon="i-heroicons-pencil"
                color="blue"
                :to="`/conventions/${convention.id}/edit`"
              >
                Modifier la convention
              </UButton>
              <UButton
                v-if="canDelete"
                icon="i-heroicons-trash"
                color="red"
                variant="soft"
                @click="deleteConvention(convention.id)"
              >
                Supprimer la convention
              </UButton>
            </div>
          </div>

          <!-- Informations sur le créateur et les collaborateurs -->
          <div class="space-y-2 pt-4 border-t">
            <p class="text-sm text-gray-600">
              <span class="font-medium">Créé par :</span> {{ convention.creator.pseudo }}
            </p>
            <div v-if="convention.collaborators && convention.collaborators.length > 0">
              <p class="text-sm font-medium text-gray-600 mb-2">Collaborateurs :</p>
              <div class="flex flex-wrap gap-2">
                <div v-for="collaborator in convention.collaborators" :key="collaborator.id" class="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                  <img 
                    :src="getUserAvatar(collaborator.user.email, 20)" 
                    :alt="`Avatar de ${collaborator.user.pseudo}`"
                    class="w-5 h-5 rounded-full"
                  />
                  <span class="text-sm">{{ collaborator.user.pseudo }}</span>
                  <UBadge :color="collaborator.canEdit ? 'green' : 'gray'" variant="subtle" size="xs">
                    {{ collaborator.canEdit ? 'Éditeur' : 'Lecture' }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConventionStore } from '~/stores/conventions';
import { useAuthStore } from '~/stores/auth';
import { useGravatar } from '~/utils/gravatar';
import ConventionCollaborators from '~/components/ConventionCollaborators.vue';
import ConventionHeader from '~/components/convention/ConventionHeader.vue';

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-client'
// });

const route = useRoute();
const router = useRouter();
const conventionStore = useConventionStore();
const authStore = useAuthStore();
const toast = useToast();
const { getUserAvatar } = useGravatar();

const conventionId = parseInt(route.params.id as string);
const convention = ref(null);

onMounted(async () => {
  try {
    convention.value = await conventionStore.fetchConventionById(conventionId);
  } catch (error) {
    console.error('Failed to fetch convention:', error);
  }
});

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!convention.value || !authStore.user?.id) return false;
  return canEdit.value || authStore.user?.id === convention.value?.creatorId;
});

// Permissions calculées
const canEdit = computed(() => {
  if (!convention.value || !authStore.user?.id) return false;
  return conventionStore.canEditConvention(convention.value, authStore.user.id);
});

const canDelete = computed(() => {
  if (!convention.value || !authStore.user?.id) return false;
  return conventionStore.canDeleteConvention(convention.value, authStore.user.id);
});

const isFavorited = computed(() => (conventionId: number) => {
  return convention.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

const deleteConvention = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette convention ?')) {
    try {
      await conventionStore.deleteConvention(id);
      toast.add({ title: 'Convention supprimée avec succès !', icon: 'i-heroicons-check-circle', color: 'green' });
      router.push('/');
    } catch (e: unknown) {
      toast.add({ title: e.statusMessage || 'Échec de la suppression de la convention', icon: 'i-heroicons-x-circle', color: 'red' });
    }
  }
};
</script>