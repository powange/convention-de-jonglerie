<template>
  <div>
    <!-- Section Conventions -->
    <div class="mb-12">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-bold">{{ $t('navigation.my_conventions') }}</h2>
          <!-- Debug: afficher toujours l'icône pour tester -->
          <UButton
            icon="i-heroicons-question-mark-circle"
            size="xs"
            color="neutral"
            variant="ghost"
            :ui="{ rounded: 'rounded-full' }"
            @click="openFeaturesModal"
          />
          <!-- Debug: afficher le nombre de conventions -->
          <span class="text-xs text-gray-500">({{ myConventions.length }} conventions)</span>
        </div>
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

      <div v-else-if="myConventions.length === 0" class="space-y-6">
        <div class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500 mb-2">{{ $t('conventions.no_conventions') }}</p>
          <p class="text-sm text-gray-400">{{ $t('conventions.no_conventions_description') }}</p>
        </div>

        <!-- Card explicative des fonctionnalités -->
        <ConventionsFeaturesCard />
      </div>

      <div v-else class="space-y-4 mb-8">
        <UCard
          v-for="convention in myConventions"
          :key="convention.id"
          class="hover:shadow-lg transition-shadow w-full"
          variant="subtle"
        >
          <template #header>
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                <div v-if="convention.logo" class="flex-shrink-0">
                  <img
                    :src="getImageUrl(convention.logo, 'convention', convention.id) || ''"
                    :alt="convention.name"
                    class="w-12 h-12 object-cover rounded-lg"
                  />
                </div>
                <div
                  v-else
                  class="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-building-library" class="text-gray-400" size="20" />
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold">{{ convention.name }}</h3>
                  <p class="text-xs text-gray-500">
                    {{ $t('conventions.created_at') }}
                    {{ formatCreatedDate(convention.createdAt) }}
                  </p>
                </div>
              </div>
              <UDropdownMenu :items="getConventionActions(convention)">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-ellipsis-horizontal"
                  size="xs"
                />
              </UDropdownMenu>
            </div>
          </template>

          <!-- Email de contact -->
          <a
            v-if="convention.email"
            :href="`mailto:${convention.email}`"
            class="text-primary-600 hover:text-primary-700 hover:underline"
          >
            {{ convention.email }}
          </a>

          <p
            v-if="convention.description"
            class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4"
          >
            {{ convention.description }}
          </p>
          <p v-else class="text-sm text-gray-400 italic mb-4">
            {{ $t('conventions.no_description') }}
          </p>

          <!-- Section collaborateurs -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ $t('conventions.collaborators') }} ({{ convention.collaborators?.length || 0 }})
              </h4>
              <div v-if="canManageCollaborators(convention)" class="flex gap-2">
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-plus"
                  @click="openAddCollaboratorModal(convention)"
                >
                  {{ $t('common.add') }}
                </UButton>
              </div>
            </div>
            <div v-if="convention.collaborators && convention.collaborators.length > 0">
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="collaborator in convention.collaborators"
                  :key="collaborator.id"
                  :color="
                    rightsSummary(collaborator).color === 'warning'
                      ? 'error'
                      : rightsSummary(collaborator).color
                  "
                  variant="subtle"
                  class="flex items-center gap-2 cursor-pointer hover:bg-opacity-80 transition-colors"
                  @click="openEditCollaboratorModal(convention, collaborator)"
                >
                  <div class="flex items-center gap-1.5">
                    <UiUserAvatar :user="collaborator.user" size="sm" />
                    <span>{{ collaborator.user?.pseudo || '' }}</span>
                    <span
                      v-if="collaborator.title && collaborator.title.trim()"
                      class="text-xs opacity-75"
                    >
                      ({{ collaborator.title.trim() }})
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
                v-if="canAddEdition(convention)"
                size="sm"
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
                  :data="convention.editions as any"
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

    <!-- Modal d'édition de collaborateur -->
    <UModal
      v-model:open="editCollaboratorModalOpen"
      :title="selectedCollaboratorForEdit ? $t('conventions.edit_collaborator_rights') : ''"
      size="lg"
    >
      <template #body>
        <div v-if="selectedCollaboratorForEdit && selectedConventionForEdit" class="space-y-4">
          <!-- Informations du collaborateur -->
          <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <UiUserAvatar :user="selectedCollaboratorForEdit.user" size="md" />
            <div>
              <h4 class="font-medium">{{ selectedCollaboratorForEdit.user?.pseudo || '' }}</h4>
              <p v-if="selectedCollaboratorForEdit.title" class="text-sm text-gray-500">
                {{ selectedCollaboratorForEdit.title }}
              </p>
            </div>
          </div>

          <!-- Configuration des droits -->
          <div>
            <label class="block text-sm font-medium mb-2"> Droits du collaborateur </label>
            <CollaboratorRightsFields
              v-model="editCollaboratorRights"
              :editions="(selectedConventionForEdit.editions || []) as any[]"
              :convention-name="selectedConventionForEdit.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeEditCollaboratorModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="savingCollaborator" @click="saveCollaboratorChanges">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal d'ajout de collaborateur -->
    <UModal
      v-model:open="addCollaboratorModalOpen"
      :title="$t('conventions.add_collaborator')"
      size="lg"
    >
      <template #body>
        <div v-if="selectedConventionForAdd" class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2"> Sélectionner un utilisateur </label>
              <UserSelector
                v-model="newCollaboratorUser"
                v-model:search-term="newCollaboratorSearchTerm"
                :searched-users="searchedUsers"
                :searching-users="searchingUsers"
                placeholder="Rechercher un utilisateur..."
              />
            </div>

            <!-- Configuration des droits -->
            <div v-if="newCollaboratorUser">
              <label class="block text-sm font-medium mb-2"> Droits du collaborateur </label>
              <CollaboratorRightsFields
                v-model="newCollaboratorRights"
                :editions="(selectedConventionForAdd.editions || []) as any[]"
                :convention-name="selectedConventionForAdd.name"
                size="sm"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeAddCollaboratorModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newCollaboratorUser" @click="addCollaborator">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal des fonctionnalités -->
    <ConventionsFeaturesModal v-model:model-value="showFeaturesModal" />

    <!-- Modal de confirmation de suppression d'édition -->
    <UModal v-model:open="deleteEditionModalOpen" title="Confirmer la suppression">
      <template #body>
        <div class="space-y-4">
          <div class="flex items-center gap-3 text-orange-600">
            <UIcon name="i-heroicons-exclamation-triangle" size="20" />
            <span class="font-medium">Attention : cette action est irréversible</span>
          </div>

          <p class="text-gray-600 dark:text-gray-300">
            Êtes-vous sûr de vouloir supprimer cette édition ? Toutes les données associées
            (bénévoles, commentaires, objets trouvés, etc.) seront définitivement perdues.
          </p>

          <div v-if="editionToDelete" class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="font-medium">{{ getEditionDisplayName(editionToDelete) }}</div>
            <div class="text-sm text-gray-500">
              {{ editionToDelete.city }}, {{ editionToDelete.country }}
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="cancelDeleteEdition">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deletingEdition" @click="confirmDeleteEdition">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h, watch, computed } from 'vue'

import { useAuthStore } from '~/stores/auth'
import type { Convention, HttpError, Edition } from '~/types'
import { summarizeRights } from '~/utils/collaboratorRights'
import { getEditionDisplayNameWithConvention } from '~/utils/editionName'

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const USwitch = resolveComponent('USwitch')

// Type pour les paramètres des cellules du tableau
interface TableCellParams {
  row: {
    original: Edition
  }
}

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const toast = useToast()
const { getImageUrl } = useImageUrl()
const { t } = useI18n()

const conventionsLoading = ref(true)
const myConventions = ref<Convention[]>([])

// Modal d'édition de collaborateur
const editCollaboratorModalOpen = ref(false)
const selectedConventionForEdit = ref<Convention | null>(null)
const selectedCollaboratorForEdit = ref<any>(null)
const editCollaboratorRights = ref<any>({
  title: null,
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageCollaborators: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  perEdition: [],
})
const savingCollaborator = ref(false)

// Modal d'ajout de collaborateur
const addCollaboratorModalOpen = ref(false)
const selectedConventionForAdd = ref<Convention | null>(null)
const newCollaboratorUser = ref<any>(null)
const newCollaboratorSearchTerm = ref('')
const newCollaboratorRights = ref<any>({
  title: null,
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageCollaborators: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  perEdition: [],
})

// Variables pour la recherche d'utilisateurs (réutilisées du UserSelector)
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)

// Watcher pour la recherche d'utilisateurs
let searchTimeout: NodeJS.Timeout | null = null

watch(newCollaboratorSearchTerm, (newValue) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!newValue || newValue.length < 2) {
    searchedUsers.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    await searchUsers(newValue)
  }, 300)
})

const searchUsers = async (query: string) => {
  if (!query || query.length < 2) {
    searchedUsers.value = []
    return
  }

  try {
    searchingUsers.value = true
    const response = await $fetch<any[]>('/api/users/search', {
      query: { q: query, limit: 10 },
    })

    searchedUsers.value = response.map((user) => ({
      id: user.id,
      label: user.pseudo,
      email: user.emailHash,
      avatar: user.profilePicture
        ? {
            src: user.profilePicture,
            alt: user.pseudo,
          }
        : undefined,
      isRealUser: true,
    }))
    console.log('Résultats de recherche:', response.length, searchedUsers.value)
  } catch (error) {
    console.error('Error searching users:', error)
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
}

// Modal fonctionnalités
const showFeaturesModal = ref(false)

// Modal de suppression d'édition
const deleteEditionModalOpen = ref(false)
const editionToDelete = ref<Edition | null>(null)
const deletingEdition = ref(false)

function openFeaturesModal() {
  console.log('Opening features modal', showFeaturesModal.value)
  showFeaturesModal.value = true
  console.log('Modal state after:', showFeaturesModal.value)
}

// Utiliser le composable pour formater les dates
const { formatDateTime } = useDateFormat()

// Utiliser le composable pour le statut des éditions
const { getStatusColor, getStatusText } = useEditionStatus()

// Actions pour les conventions
const getConventionActions = (convention: Convention) => {
  const actions = []

  if (canEditConvention(convention)) {
    actions.push({
      label: t('conventions.edit'),
      icon: 'i-heroicons-pencil',
      to: `/conventions/${convention.id}/edit`,
    })
  }

  if (canDeleteConvention(convention)) {
    actions.push({
      label: t('conventions.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteConvention(convention.id),
    })
  }

  return [actions]
}

// Colonnes pour le tableau des éditions
const getEditionsColumns = () => [
  {
    accessorKey: 'name',
    header: t('common.name'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      // Récupérer la convention depuis le contexte parent
      const convention = myConventions.value.find((conv) =>
        conv.editions?.some((ed) => ed.id === edition.id)
      )
      const displayName = getEditionDisplayNameWithConvention(edition, convention)

      return h('div', { class: 'flex items-center gap-2' }, [
        edition.imageUrl
          ? h('img', {
              src: getImageUrl(edition.imageUrl, 'edition', edition.id),
              alt: displayName,
              class: 'w-10 h-10 object-cover rounded flex-shrink-0',
            })
          : h(
              'div',
              {
                class:
                  'w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0',
              },
              [
                h('UIcon', {
                  name: 'i-heroicons-calendar-days',
                  class: 'text-gray-400',
                  size: '20',
                }),
              ]
            ),
        h('span', { class: 'font-medium text-sm' }, displayName),
      ])
    },
  },
  {
    accessorKey: 'dates',
    header: t('common.dates'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      return h('div', { class: 'text-sm' }, [
        h('div', {}, formatDateTime(edition.startDate)),
        h('div', { class: 'text-gray-400 text-xs' }, formatDateTime(edition.endDate)),
      ])
    },
  },
  {
    accessorKey: 'location',
    header: t('common.location'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      return h('div', { class: 'text-sm' }, [
        h('div', {}, edition.city),
        h('div', { class: 'text-gray-400 text-xs' }, edition.country),
      ])
    },
  },
  {
    accessorKey: 'status',
    header: t('common.status'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      return h(
        UBadge,
        {
          color: getStatusColor(edition),
          variant: 'subtle',
          size: 'md',
        },
        () => getStatusText(edition)
      )
    },
  },
  {
    accessorKey: 'online',
    header: t('editions.online_status'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      const convention = myConventions.value.find((conv) =>
        conv.editions?.some((ed) => ed.id === edition.id)
      )
      const allowed = convention && canEditEdition(convention, edition.id)
      return h('div', { class: 'flex justify-center' }, [
        h(USwitch, {
          modelValue: edition.isOnline,
          color: 'primary',
          size: 'sm',
          disabled: !allowed,
          'onUpdate:modelValue': (value: boolean) =>
            allowed && toggleEditionOnlineStatus(edition.id, value),
        }),
      ])
    },
  },
  {
    id: 'actions',
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      const convention = myConventions.value.find((conv) =>
        conv.editions?.some((ed) => ed.id === edition.id)
      )
      const canEdit = convention && canEditEdition(convention, edition.id)
      const canDelete = convention && canDeleteEdition(convention, edition.id)

      const actions: any[] = [
        {
          label: t('common.view'),
          icon: 'i-heroicons-eye',
          to: `/editions/${edition.id}`,
        },
      ]

      if (canEdit) {
        actions.push({
          label: t('common.edit'),
          icon: 'i-heroicons-pencil',
          to: `/editions/${edition.id}/edit`,
        })
      }

      if (canDelete) {
        actions.push({
          label: t('common.delete'),
          icon: 'i-heroicons-trash',
          color: 'error' as const,
          onSelect: () => deleteEdition(edition.id),
        })
      }

      return h(
        resolveComponent('UDropdownMenu'),
        {
          items: [actions],
        },
        {
          default: () =>
            h(resolveComponent('UButton'), {
              color: 'neutral',
              variant: 'ghost',
              icon: 'i-heroicons-ellipsis-horizontal',
              size: 'xs',
            }),
        }
      )
    },
  },
]

// Gestionnaire d'événement pour les actions
const onEditionAction = (_action: unknown) => {
  // Cette fonction est appelée automatiquement par UTable
}

// Computed pour optimiser les calculs
const formatCreatedDate = computed(() => {
  return (dateString: string) => new Date(dateString).toLocaleDateString()
})

// Fonctions pour gérer les collaborateurs
const openEditCollaboratorModal = (convention: Convention, collaborator: any) => {
  if (!canManageCollaborators(convention)) {
    toast.add({
      title: 'Action non autorisée',
      description: "Vous n'avez pas les droits pour modifier ce collaborateur",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    return
  }

  selectedConventionForEdit.value = convention
  selectedCollaboratorForEdit.value = collaborator

  // Charger les droits actuels du collaborateur
  editCollaboratorRights.value = {
    title: collaborator.title || '',
    rights: { ...collaborator.rights },
    perEdition: [...(collaborator.perEdition || [])],
  }

  editCollaboratorModalOpen.value = true
}

const closeEditCollaboratorModal = () => {
  editCollaboratorModalOpen.value = false
  selectedConventionForEdit.value = null
  selectedCollaboratorForEdit.value = null
  editCollaboratorRights.value = {
    title: null,
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageCollaborators: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    perEdition: [],
  }
}

const saveCollaboratorChanges = async () => {
  if (!selectedCollaboratorForEdit.value || !selectedConventionForEdit.value) {
    return
  }

  try {
    savingCollaborator.value = true

    await $fetch(
      `/api/conventions/${selectedConventionForEdit.value.id}/collaborators/${selectedCollaboratorForEdit.value.id}`,
      {
        method: 'PUT',
        body: {
          rights: editCollaboratorRights.value.rights,
          title: editCollaboratorRights.value.title,
          perEdition: editCollaboratorRights.value.perEdition || [],
        },
      }
    )

    toast.add({
      title: 'Droits mis à jour',
      description: 'Les droits du collaborateur ont été modifiés avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal et recharger les conventions
    closeEditCollaboratorModal()
    await fetchMyConventions()
  } catch (error: unknown) {
    const httpError = error as HttpError
    console.error('Error updating collaborator rights:', error)
    toast.add({
      title: 'Erreur lors de la mise à jour',
      description: httpError.data?.message || httpError.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    savingCollaborator.value = false
  }
}

const openAddCollaboratorModal = (convention: Convention) => {
  selectedConventionForAdd.value = convention
  // Réinitialiser les valeurs
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  newCollaboratorRights.value = {
    title: null,
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageCollaborators: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    perEdition: [],
  }
  searchedUsers.value = []
  addCollaboratorModalOpen.value = true
}

const closeAddCollaboratorModal = () => {
  addCollaboratorModalOpen.value = false
  selectedConventionForAdd.value = null
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  searchedUsers.value = []
}

const addCollaborator = async () => {
  if (!newCollaboratorUser.value || !selectedConventionForAdd.value) {
    return
  }

  try {
    await $fetch(`/api/conventions/${selectedConventionForAdd.value.id}/collaborators`, {
      method: 'POST',
      body: {
        userId: newCollaboratorUser.value.id,
        rights: newCollaboratorRights.value.rights,
        title: newCollaboratorRights.value.title,
        perEdition: newCollaboratorRights.value.perEdition || [],
      },
    })

    toast.add({
      title: 'Collaborateur ajouté',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal et recharger les conventions
    closeAddCollaboratorModal()
    await fetchMyConventions()
  } catch (error: unknown) {
    const httpError = error as HttpError
    console.error('Error adding collaborator:', error)
    toast.add({
      title: "Erreur lors de l'ajout",
      description: httpError.data?.message || httpError.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const deleteEdition = async (id: number) => {
  // Trouver l'édition à supprimer pour l'afficher dans le modal
  const edition = myConventions.value
    .flatMap((conv) => conv.editions || [])
    .find((ed) => ed.id === id)

  if (edition) {
    editionToDelete.value = edition
    deleteEditionModalOpen.value = true
  }
}

const cancelDeleteEdition = () => {
  deleteEditionModalOpen.value = false
  editionToDelete.value = null
  deletingEdition.value = false
}

const confirmDeleteEdition = async () => {
  if (!editionToDelete.value) return

  try {
    deletingEdition.value = true

    await $fetch(`/api/editions/${editionToDelete.value.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: t('messages.edition_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer le modal et recharger les conventions
    cancelDeleteEdition()
    await fetchMyConventions()
  } catch (e: unknown) {
    const error = e as HttpError
    toast.add({
      title: t('errors.deletion_error'),
      description: error.message || error.data?.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    deletingEdition.value = false
  }
}

// Fonction pour récupérer les conventions de l'utilisateur
const fetchMyConventions = async () => {
  try {
    conventionsLoading.value = true

    const data = await $fetch<Convention[]>('/api/conventions/my-conventions')

    myConventions.value = data || []

    // Mettre à jour la convention sélectionnée si la modal est ouverte
    if (selectedConventionForEdit.value && editCollaboratorModalOpen.value) {
      const updatedConvention = myConventions.value.find(
        (c) => c.id === selectedConventionForEdit.value!.id
      )
      if (updatedConvention) {
        selectedConventionForEdit.value = updatedConvention
      }
    }
  } catch (error) {
    console.error('Error fetching conventions:', error)
    toast.add({
      title: t('common.error'),
      description: t('conventions.cannot_load_conventions'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
  } finally {
    conventionsLoading.value = false
  }
}

// Fonction pour supprimer une convention
const deleteConvention = async (id: number) => {
  if (confirm(t('conventions.confirm_delete_convention'))) {
    try {
      await $fetch(`/api/conventions/${id}`, {
        method: 'DELETE',
      })

      toast.add({
        title: t('conventions.convention_deleted'),
        description: t('conventions.convention_deleted_success'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })

      // Recharger la liste des conventions
      await fetchMyConventions()
    } catch (error: unknown) {
      const httpError = error as HttpError
      console.error('Error deleting convention:', error)
      toast.add({
        title: t('errors.deletion_error'),
        description: httpError.data?.message || httpError.message || t('errors.server_error'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

// Helpers de droits (auteur = super droit implicite)
function currentUserId() {
  return authStore.user?.id
}
function findCurrentCollab(convention: Convention) {
  const uid = currentUserId()
  if (!uid) return undefined
  return convention.collaborators?.find((c: any) => c.user.id === uid)
}
const isAuthor = (convention: Convention) =>
  currentUserId() && convention.authorId && convention.authorId === currentUserId()
const canManageCollaborators = (convention: Convention) =>
  !!(isAuthor(convention) || findCurrentCollab(convention)?.rights?.manageCollaborators)
const canAddEdition = (convention: Convention) =>
  !!(isAuthor(convention) || findCurrentCollab(convention)?.rights?.addEdition)
const canEditConvention = (convention: Convention) =>
  !!(isAuthor(convention) || findCurrentCollab(convention)?.rights?.editConvention)
const canDeleteConvention = (convention: Convention) =>
  !!(isAuthor(convention) || findCurrentCollab(convention)?.rights?.deleteConvention)
const canEditEdition = (convention: Convention, editionId: number) => {
  if (isAuthor(convention)) return true
  const collab = findCurrentCollab(convention)
  if (!collab) return false
  if (collab.rights?.editAllEditions) return true
  return (collab as any).perEdition?.some((p: any) => p.editionId === editionId && p.canEdit)
}
const canDeleteEdition = (convention: Convention, editionId: number) => {
  if (isAuthor(convention)) return true
  const collab = findCurrentCollab(convention)
  if (!collab) return false
  if (collab.rights?.deleteAllEditions) return true
  return (collab as any).perEdition?.some((p: any) => p.editionId === editionId && p.canDelete)
}

function rightsSummary(collaborator: any) {
  return summarizeRights(collaborator.rights || {})
}

// Fonction pour obtenir le nom d'affichage d'une édition
const getEditionDisplayName = (edition: Edition) => {
  const convention = myConventions.value.find((conv) =>
    conv.editions?.some((ed) => ed.id === edition.id)
  )
  return getEditionDisplayNameWithConvention(edition, convention)
}

// Toggle edition online status
const toggleEditionOnlineStatus = async (editionId: number, isOnline: boolean) => {
  try {
    await $fetch(`/api/editions/${editionId}/status`, {
      method: 'PATCH',
      body: { isOnline },
    })

    const message = isOnline ? t('editions.edition_published') : t('editions.edition_set_offline')
    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Reload conventions to update the status
    await fetchMyConventions()
  } catch (error) {
    console.error('Failed to toggle edition status:', error)
    toast.add({
      title: t('errors.status_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

onMounted(async () => {
  // Vérifier que l'utilisateur est authentifié
  if (!authStore.isAuthenticated) {
    conventionsLoading.value = false
    return
  }

  // Charger les conventions
  await fetchMyConventions()
})
</script>
