<template>
  <div>
    <!-- Section Conventions -->
    <div class="mb-12">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">{{ $t('conventions.my_conventions') }}</h2>
        <UButton 
          icon="i-heroicons-plus" 
          size="sm" 
          color="primary" 
          variant="outline" 
          :label="t('conventions.create')" 
          to="/conventions/add"
        />
      </div>

      <div v-if="conventionsLoading" class="text-center py-8">
        <p>{{ $t('common.loading') }}</p>
      </div>

      <div v-else-if="myConventions.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p class="text-gray-500 mb-2">{{ $t('conventions.no_conventions') }}</p>
        <p class="text-sm text-gray-400">{{ $t('conventions.no_conventions_description') }}</p>
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
                  <p class="text-xs text-gray-500">{{ $t('conventions.created_at') }} {{ new Date(convention.createdAt).toLocaleDateString() }}</p>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <UButton
                  v-if="canEditConvention(convention)"
                  icon="i-heroicons-pencil"
                  size="xs"
                  color="warning"
                  variant="ghost"
                  :title="t('conventions.edit')"
                  :to="`/conventions/${convention.id}/edit`"
                />
                <UButton
                  v-if="canDeleteConvention(convention)"
                  icon="i-heroicons-trash"
                  size="xs"
                  color="error"
                  variant="ghost"
                  :title="t('conventions.delete')"
                  @click="deleteConvention(convention.id)"
                />
              </div>
            </div>
          </template>
          
          <p v-if="convention.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
            {{ convention.description }}
          </p>
          <p v-else class="text-sm text-gray-400 italic mb-4">{{ $t('conventions.no_description') }}</p>
          
          <!-- Section collaborateurs -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ $t('conventions.collaborators') }} ({{ convention.collaborators?.length || 0 }})
              </h4>
              <UButton 
                size="xs" 
                variant="outline" 
                icon="i-heroicons-user-plus"
                @click="openCollaboratorsModal(convention)"
              >
                {{ $t('conventions.manage') }}
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
                  <UserAvatar 
                    :user="collaborator.user" 
                    size="xs"
                  />
                  <span>{{ collaborator.user.pseudo }}</span>
                  <span class="text-xs opacity-75">
                    ({{ collaborator.role === 'ADMINISTRATOR' ? t('conventions.admin') : t('conventions.moderator') }})
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
                {{ $t('conventions.editions') }} ({{ convention.editions?.length || 0 }})
              </h4>
              <UButton 
                size="xs" 
                variant="outline" 
                icon="i-heroicons-plus"
                :to="`/conventions/${convention.id}/editions/add`"
              >
                {{ $t('conventions.add_edition') }}
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
              <p class="text-sm text-gray-500">{{ $t('conventions.no_editions') }}</p>
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
import UserAvatar from '~/components/ui/UserAvatar.vue';

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const USwitch = resolveComponent('USwitch')
const UButtonGroup = resolveComponent('UButtonGroup')
const UTooltip = resolveComponent('UTooltip')

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
const { t } = useI18n();

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
    header: t('common.name'),
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
    header: t('common.dates'),
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
    header: t('common.location'),
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
    header: t('common.status'),
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
    accessorKey: 'online',
    header: t('editions.online_status'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h('div', { class: 'flex justify-center' }, [
        h(USwitch, {
          modelValue: edition.isOnline,
          color: 'primary',
          size: 'sm',
          'onUpdate:modelValue': (value: boolean) => toggleEditionOnlineStatus(edition.id, value)
        })
      ]);
    }
  },
  {
    id: 'actions',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original;
      return h(UButtonGroup, { size: 'xs' }, [
        h(UTooltip, { text: t('common.view') }, () =>
          h(UButton, {
            icon: 'i-heroicons-eye',
            color: 'info',
            variant: 'ghost',
            onClick: () => navigateTo(`/editions/${edition.id}`)
          })
        ),
        h(UTooltip, { text: t('common.edit') }, () =>
          h(UButton, {
            icon: 'i-heroicons-pencil',
            color: 'warning',
            variant: 'ghost',
            onClick: () => navigateTo(`/editions/${edition.id}/edit`)
          })
        ),
        h(UTooltip, { text: t('common.delete') }, () =>
          h(UButton, {
            icon: 'i-heroicons-trash',
            color: 'error',
            variant: 'ghost',
            onClick: () => deleteEdition(edition.id)
          })
        )
      ]);
    }
  }
];

// Gestionnaire d'événement pour les actions
const onEditionAction = (_action: unknown) => {
  // Cette fonction est appelée automatiquement par UTable
};

// Fonctions pour gérer les collaborateurs
const openCollaboratorsModal = (convention: Convention) => {
  selectedConvention.value = convention;
  collaboratorsModalOpen.value = true;
};

const deleteEdition = async (_id: number) => {
  if (confirm(t('conventions.confirm_delete_edition'))) {
    try {
      // Recharger les conventions après suppression pour mettre à jour les tableaux
      await fetchMyConventions();
      toast.add({ 
        title: t('messages.edition_deleted'), 
        icon: 'i-heroicons-check-circle', 
  color: 'success' 
      });
    } catch (e: unknown) {
      const error = e as HttpError;
      toast.add({ 
        title: t('errors.deletion_error'), 
        description: error.message || error.data?.message || t('errors.server_error'),
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
    
  const data = await $fetch<Convention[]>('/api/conventions/my-conventions');
    
    myConventions.value = data || [];
    
    // Mettre à jour la convention sélectionnée si la modal est ouverte
    if (selectedConvention.value && collaboratorsModalOpen.value) {
      const updatedConvention = myConventions.value.find(c => c.id === selectedConvention.value!.id);
      if (updatedConvention) {
        selectedConvention.value = updatedConvention;
      }
    }
  } catch (error) {
    console.error('Error fetching conventions:', error);
    toast.add({ 
      title: t('common.error'), 
      description: t('conventions.cannot_load_conventions'),
  icon: 'i-heroicons-exclamation-triangle', 
  color: 'error' 
    });
  } finally {
    conventionsLoading.value = false;
  }
};

// Fonction pour supprimer une convention
const deleteConvention = async (id: number) => {
  if (confirm(t('conventions.confirm_delete_convention'))) {
    try {
      await $fetch(`/api/conventions/${id}`, {
        method: 'DELETE',
      });
      
      toast.add({ 
        title: t('conventions.convention_deleted'), 
        description: t('conventions.convention_deleted_success'),
        icon: 'i-heroicons-check-circle', 
    color: 'success' 
      });
      
      // Recharger la liste des conventions
      await fetchMyConventions();
    } catch (error: unknown) {
      const httpError = error as HttpError;
      console.error('Error deleting convention:', error);
      toast.add({ 
        title: t('errors.deletion_error'), 
        description: httpError.data?.message || httpError.message || t('errors.server_error'),
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

// Toggle edition online status
const toggleEditionOnlineStatus = async (editionId: number, isOnline: boolean) => {
  try {
    await $fetch(`/api/editions/${editionId}/status`, {
      method: 'PATCH',
      body: { isOnline }
    });
    
    const message = isOnline ? t('editions.edition_published') : t('editions.edition_set_offline');
    toast.add({ 
      title: message, 
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
    
    // Reload conventions to update the status
    await fetchMyConventions();
  } catch (error) {
    console.error('Failed to toggle edition status:', error);
    toast.add({ 
      title: t('errors.status_update_failed'), 
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  }
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