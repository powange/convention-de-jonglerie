<template>
  <div>
    <!-- Section Conventions -->
    <div class="mb-12">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Mes Conventions</h2>
        <UButton 
          icon="i-heroicons-plus" 
          size="sm" 
          color="primary" 
          variant="outline" 
          label="Créer une Convention" 
          to="/conventions/add"
        />
      </div>

      <div v-if="conventionsLoading" class="text-center py-8">
        <p>Chargement de vos conventions...</p>
      </div>

      <div v-else-if="myConventions.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p class="text-gray-500 mb-2">Aucune convention créée</p>
        <p class="text-sm text-gray-400">Les conventions vous permettront de regrouper plusieurs éditions.</p>
      </div>

      <div v-else class="space-y-4 mb-8">
        <UCard v-for="convention in myConventions" :key="convention.id" class="hover:shadow-lg transition-shadow w-full"  variant="subtle">
          <template #header>
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                <div v-if="convention.logo" class="flex-shrink-0">
                  <img :src="normalizeImageUrl(convention.logo)" :alt="convention.name" class="w-12 h-12 object-cover rounded-lg" >
                </div>
                <div v-else class="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <UIcon name="i-heroicons-building-library" class="text-gray-400" size="20" />
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold">{{ convention.name }}</h3>
                  <p class="text-xs text-gray-500">Créée le {{ new Date(convention.createdAt).toLocaleDateString() }}</p>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <UButton
                  v-if="canEditConvention(convention)"
                  icon="i-heroicons-pencil"
                  size="xs"
                  color="warning"
                  variant="ghost"
                  title="Modifier la convention"
                  :to="`/conventions/${convention.id}/edit`"
                />
                <UButton
                  v-if="canDeleteConvention(convention)"
                  icon="i-heroicons-trash"
                  size="xs"
                  color="error"
                  variant="ghost"
                  title="Supprimer la convention"
                  @click="deleteConvention(convention.id)"
                />
              </div>
            </div>
          </template>
          
          <p v-if="convention.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
            {{ convention.description }}
          </p>
          <p v-else class="text-sm text-gray-400 italic mb-4">Aucune description</p>
          
          <!-- Section collaborateurs -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                Collaborateurs ({{ convention.collaborators?.length || 0 }})
              </h4>
              <UButton 
                size="xs" 
                variant="outline" 
                icon="i-heroicons-user-plus"
                @click="openCollaboratorsModal(convention)"
              >
                Gérer
              </UButton>
            </div>
            <div v-if="convention.collaborators && convention.collaborators.length > 0">
            <div class="flex flex-wrap gap-2">
              <UBadge 
                v-for="collaborator in convention.collaborators" 
                :key="collaborator.id"
                :color="collaborator.role === 'ADMINISTRATOR' ? 'error' : 'info'"
                variant="subtle"
                size="sm"
                class="flex items-center gap-2"
              >
                <div class="flex items-center gap-1.5">
                  <div v-if="collaborator.user.profilePicture" class="flex-shrink-0">
                    <img 
                      :src="normalizeImageUrl(collaborator.user.profilePicture)" 
                      :alt="collaborator.user.pseudo" 
                      class="w-4 h-4 object-cover rounded-full" 
                    >
                  </div>
                  <div v-else class="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <UIcon name="i-heroicons-user" class="text-gray-500 dark:text-gray-400" size="10" />
                  </div>
                  <span>{{ collaborator.user.pseudo }}</span>
                  <span class="text-xs opacity-75">
                    ({{ collaborator.role === 'ADMINISTRATOR' ? 'Admin' : 'Modo' }})
                  </span>
                </div>
              </UBadge>
            </div>
            </div>
          </div>
          
          <!-- Section éditions -->
          <div class="mt-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                Éditions ({{ convention.editions?.length || 0 }})
              </h4>
              <UButton 
                size="xs" 
                variant="outline" 
                icon="i-heroicons-plus"
                :to="`/conventions/${convention.id}/editions/add`"
              >
                Ajouter une édition
              </UButton>
            </div>
            
            <!-- Tableau des éditions -->
            <div v-if="convention.editions && convention.editions.length > 0">
              <div class="overflow-x-auto">
                <UTable 
                  :data="convention.editions" 
                  :columns="getEditionsColumns()"
                  @select="onEditionAction"
                />
              </div>
            </div>
            
            <!-- Message quand pas d'éditions -->
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-calendar-days" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">Aucune édition pour cette convention</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal de gestion des collaborateurs -->
    <CollaboratorsModal 
      v-model="collaboratorsModalOpen"
      :convention="selectedConvention"
      :current-user-id="authStore.user?.id"
      @collaborator-added="fetchMyConventions"
      @collaborator-removed="fetchMyConventions"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useAuthStore } from '~/stores/auth';
import type { Convention, HttpError, Edition } from '~/types';
import { getEditionDisplayNameWithConvention } from '~/utils/editionName';

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

// Type pour les paramètres des cellules du tableau
interface TableCellParams {
  row: {
    original: Edition;
  };
}

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const authStore = useAuthStore();
const toast = useToast();
const { normalizeImageUrl } = useImageUrl();

const conventionsLoading = ref(true);
const myConventions = ref<Convention[]>([]);

// Modal collaborateurs
const collaboratorsModalOpen = ref(false);
const selectedConvention = ref<Convention | null>(null);


// Utiliser le composable pour formater les dates
const { formatDateTime } = useDateFormat();

// Utiliser le composable pour le statut des éditions
const { getStatusColor, getStatusText } = useEditionStatus();


// Colonnes pour le tableau des éditions
const getEditionsColumns = () => [
  {
    accessorKey: 'name',
    header: 'Nom',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      // Récupérer la convention depuis le contexte parent
      const convention = myConventions.value.find(conv => 
        conv.editions?.some(ed => ed.id === edition.id)
      );
      const displayName = getEditionDisplayNameWithConvention(edition, convention);
      
      return h('div', { class: 'flex items-center gap-2' }, [
        edition.imageUrl 
          ? h('img', { 
              src: normalizeImageUrl(edition.imageUrl), 
              alt: displayName, 
              class: 'w-10 h-10 object-cover rounded flex-shrink-0' 
            })
          : h('div', { 
              class: 'w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0' 
            }, [
              h('UIcon', { name: 'i-heroicons-calendar-days', class: 'text-gray-400', size: '20' })
            ]),
        h('span', { class: 'font-medium text-sm' }, displayName)
      ]);
    }
  },
  {
    accessorKey: 'dates',
    header: 'Dates',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h('div', { class: 'text-sm' }, [
        h('div', {}, formatDateTime(edition.startDate)),
        h('div', { class: 'text-gray-400 text-xs' }, formatDateTime(edition.endDate))
      ]);
    }
  },
  {
    accessorKey: 'location',
    header: 'Lieu',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h('div', { class: 'text-sm' }, [
        h('div', {}, edition.city),
        h('div', { class: 'text-gray-400 text-xs' }, edition.country)
      ]);
    }
  },
  {
    accessorKey: 'status',
    header: 'État',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h(UBadge, {
        color: getStatusColor(edition),
        variant: 'subtle',
        size: 'sm'
      }, () => getStatusText(edition));
    }
  },
  {
    id: 'actions',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UButton, {
          icon: 'i-heroicons-eye',
          size: 'xs',
          color: 'info',
          variant: 'ghost',
          label: 'Voir',
          onClick: () => navigateTo(`/editions/${edition.id}`)
        }),
        h(UButton, {
          icon: 'i-heroicons-pencil',
          size: 'xs',
          color: 'warning',
          variant: 'ghost',
          label: 'Modifier',
          onClick: () => navigateTo(`/editions/${edition.id}/edit`)
        }),
        h(UButton, {
          icon: 'i-heroicons-trash',
          size: 'xs',
          color: 'error',
          variant: 'ghost',
          label: 'Supprimer',
          onClick: () => deleteEdition(edition.id)
        })
      ]);
    }
  }
];

// Gestionnaire d'événement pour les actions
const onEditionAction = (action: unknown) => {
  // Cette fonction est appelée automatiquement par UTable
};

// Fonctions pour gérer les collaborateurs
const openCollaboratorsModal = (convention: Convention) => {
  selectedConvention.value = convention;
  collaboratorsModalOpen.value = true;
};

const deleteEdition = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette édition ?')) {
    try {
      // Recharger les conventions après suppression pour mettre à jour les tableaux
      await fetchMyConventions();
      toast.add({ 
        title: 'Édition supprimée avec succès !', 
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
    } catch (e: unknown) {
      const error = e as HttpError;
      toast.add({ 
        title: 'Erreur lors de la suppression', 
        description: error.message || error.data?.message || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  }
};

// Fonction pour récupérer les conventions de l'utilisateur
const fetchMyConventions = async () => {
  try {
    conventionsLoading.value = true;
    
    // Vérifier que l'utilisateur est connecté et a un token
    if (!authStore.token) {
      console.warn('Aucun token d\'authentification disponible');
      myConventions.value = [];
      return;
    }
    
    const data = await $fetch<Convention[]>('/api/conventions/my-conventions', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    myConventions.value = data || [];
    
    // Mettre à jour la convention sélectionnée si la modal est ouverte
    if (selectedConvention.value && collaboratorsModalOpen.value) {
      const updatedConvention = myConventions.value.find(c => c.id === selectedConvention.value!.id);
      if (updatedConvention) {
        selectedConvention.value = updatedConvention;
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des conventions:', error);
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de charger vos conventions',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    conventionsLoading.value = false;
  }
};

// Fonction pour supprimer une convention
const deleteConvention = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette convention ?')) {
    try {
      await $fetch(`/api/conventions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
        },
      });
      
      toast.add({ 
        title: 'Convention supprimée', 
        description: 'La convention a été supprimée avec succès',
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
      
      // Recharger la liste des conventions
      await fetchMyConventions();
    } catch (error: unknown) {
      const httpError = error as HttpError;
      console.error('Erreur lors de la suppression de la convention:', error);
      toast.add({ 
        title: 'Erreur lors de la suppression', 
        description: httpError.data?.message || httpError.message || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  }
};

// Vérifier si l'utilisateur peut modifier une convention
const canEditConvention = (convention: Convention) => {
  if (!authStore.user) return false;
  
  // L'auteur peut toujours modifier
  if (convention.authorId === authStore.user.id) return true;
  
  // Les collaborateurs ADMINISTRATOR peuvent modifier
  return convention.collaborators?.some(
    collab => collab.user.id === authStore.user.id && collab.role === 'ADMINISTRATOR'
  ) || false;
};

// Vérifier si l'utilisateur peut supprimer une convention
const canDeleteConvention = (convention: Convention) => {
  if (!authStore.user) return false;
  
  // L'auteur peut toujours supprimer
  if (convention.authorId === authStore.user.id) return true;
  
  // Les collaborateurs ADMINISTRATOR peuvent supprimer
  return convention.collaborators?.some(
    collab => collab.user.id === authStore.user.id && collab.role === 'ADMINISTRATOR'
  ) || false;
};

onMounted(async () => {
  // Vérifier que l'utilisateur est authentifié
  if (!authStore.isAuthenticated) {
    conventionsLoading.value = false;
    return;
  }

  // Charger les conventions
  await fetchMyConventions();
});
</script>