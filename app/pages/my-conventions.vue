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

      <div v-else-if="myConventions.length === 0" class="py-12">
        <!-- Hero Empty State -->
        <div class="max-w-2xl mx-auto text-center mb-12">
          <!-- Icon simple -->
          <div class="flex justify-center mb-8">
            <div
              class="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center"
            >
              <UIcon
                name="i-heroicons-building-library"
                class="text-primary-600 dark:text-primary-400"
                size="40"
              />
            </div>
          </div>

          <!-- Titre et description -->
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {{ $t('conventions.empty_state_title') }}
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            {{ $t('conventions.empty_state_description') }}
          </p>

          <!-- CTA Bouton -->
          <UButton
            color="primary"
            size="lg"
            icon="i-heroicons-plus"
            :label="$t('conventions.create_first_convention')"
            to="/conventions/add"
          />
        </div>

        <!-- Features Card -->
        <div class="max-w-4xl mx-auto">
          <ConventionsFeaturesCard :show-footer="false" />
        </div>
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

          <!-- Section organisateurs -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ $t('conventions.organizers') }} ({{ convention.organizers?.length || 0 }})
              </h4>
              <div v-if="canManageOrganizers(convention)" class="flex gap-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-clock"
                  @click="openHistoryModal(convention)"
                >
                  {{ $t('conventions.history.title') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-plus"
                  @click="openAddOrganizerModal(convention)"
                >
                  {{ $t('common.add') }}
                </UButton>
              </div>
            </div>
            <div v-if="convention.organizers && convention.organizers.length > 0">
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="organizer in convention.organizers"
                  :key="organizer.id"
                  class="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  @click="openEditOrganizerModal(convention, organizer)"
                >
                  <UiUserDisplay :user="organizer.user" size="xs">
                    <template v-if="organizer.title" #datetime>
                      <span class="text-xs text-gray-600 dark:text-gray-400">
                        {{ organizer.title }}
                      </span>
                    </template>
                  </UiUserDisplay>
                </div>
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

    <!-- Modal d'édition de organisateur -->
    <UModal
      v-model:open="editOrganizerModalOpen"
      :title="selectedOrganizerForEdit ? $t('conventions.edit_organizer_rights') : ''"
      size="lg"
    >
      <template #body>
        <div v-if="selectedOrganizerForEdit && selectedConventionForEdit" class="space-y-4">
          <!-- Informations du organisateur -->
          <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <UiUserAvatar :user="selectedOrganizerForEdit.user" size="md" />
            <div>
              <h4 class="font-medium">{{ selectedOrganizerForEdit.user?.pseudo || '' }}</h4>
              <p v-if="selectedOrganizerForEdit.title" class="text-sm text-gray-500">
                {{ selectedOrganizerForEdit.title }}
              </p>
            </div>
          </div>

          <!-- Configuration des droits -->
          <div>
            <label class="block text-sm font-medium mb-2"> Droits du organisateur </label>
            <OrganizerRightsFields
              v-model="editOrganizerRights"
              :editions="(selectedConventionForEdit.editions || []) as any[]"
              :convention-name="selectedConventionForEdit.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeEditOrganizerModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="savingOrganizer" @click="saveOrganizerChanges">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal d'ajout de organisateur -->
    <UModal v-model:open="addOrganizerModalOpen" :title="$t('conventions.add_organizer')" size="lg">
      <template #body>
        <div v-if="selectedConventionForAdd" class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2"> Sélectionner un utilisateur </label>
              <UserSelector
                v-model="newOrganizerUser"
                v-model:search-term="newOrganizersearchTerm"
                :searched-users="searchedUsers"
                :searching-users="searchingUsers"
                :placeholder="$t('gestion.organizers.search_user_placeholder')"
              />
            </div>

            <!-- Configuration des droits -->
            <div v-if="newOrganizerUser">
              <label class="block text-sm font-medium mb-2"> Droits du organisateur </label>
              <OrganizerRightsFields
                v-model="newOrganizerRights"
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
          <UButton variant="ghost" @click="closeAddOrganizerModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newOrganizerUser" @click="addOrganizer">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal des fonctionnalités -->
    <ConventionsFeaturesModal v-model:model-value="showFeaturesModal" />

    <!-- Modal de l'historique des organisateurs -->
    <UModal
      v-model:open="historyModalOpen"
      :title="
        selectedConventionForHistory
          ? $t('conventions.history.title_full', { name: selectedConventionForHistory.name })
          : ''
      "
      size="lg"
    >
      <template #body>
        <div v-if="selectedConventionForHistory">
          <ConventionOrganizerHistory :convention-id="selectedConventionForHistory.id" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton variant="ghost" @click="closeHistoryModal">
            {{ $t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>

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
import { getEditionDisplayNameWithConvention } from '~/utils/editionName'

// Charger les traductions du fichier edition.json pour les clés edition.*
await useLazyI18n('edition')

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const USelect = resolveComponent('USelect')

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

// Modal d'édition de organisateur
const editOrganizerModalOpen = ref(false)
const selectedConventionForEdit = ref<Convention | null>(null)
const selectedOrganizerForEdit = ref<any>(null)
const editOrganizerRights = ref<any>({
  title: null,
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageOrganizers: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  perEdition: [],
})
const savingOrganizer = ref(false)

// Modal d'ajout de organisateur
const addOrganizerModalOpen = ref(false)
const selectedConventionForAdd = ref<Convention | null>(null)
const newOrganizerUser = ref<any>(null)
const newOrganizersearchTerm = ref('')
const newOrganizerRights = ref<any>({
  title: null,
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageOrganizers: false,
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

watch(newOrganizersearchTerm, (newValue) => {
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

const searchUsers = async (email: string) => {
  // Validation basique d'email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    searchedUsers.value = []
    return
  }

  try {
    searchingUsers.value = true
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      query: { emailExact: email },
    })

    searchedUsers.value = response.users.map((user) => ({
      id: user.id,
      label: user.pseudo || `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
      pseudo: user.pseudo || `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
      email: user.email,
      emailHash: user.emailHash,
      profilePicture: user.profilePicture,
      isRealUser: true,
    }))
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

// Historique des organisateurs
const historyModalOpen = ref(false)
const selectedConventionForHistory = ref<Convention | null>(null)

function openFeaturesModal() {
  console.log('Opening features modal', showFeaturesModal.value)
  showFeaturesModal.value = true
  console.log('Modal state after:', showFeaturesModal.value)
}

function openHistoryModal(convention: Convention) {
  selectedConventionForHistory.value = convention
  historyModalOpen.value = true
}

function closeHistoryModal() {
  historyModalOpen.value = false
  selectedConventionForHistory.value = null
}

// Utiliser le composable pour formater les dates
const { formatDateTime } = useDateFormat()

// Utiliser le composable pour le statut des éditions
const { getStatusColor, getStatusText, statusOptions: editionStatusOptions } = useEditionStatus()

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
    accessorKey: 'volunteers',
    header: t('edition.volunteers.title'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      const count = (edition as any)._count?.volunteerApplications || 0
      return h('div', { class: 'flex items-center gap-1 text-sm' }, [
        h('UIcon', { name: 'i-heroicons-hand-raised', class: 'w-4 h-4 text-primary-600' }),
        h('span', {}, count.toString()),
      ])
    },
  },
  {
    accessorKey: 'participants',
    header: t('common.participants'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      const count = (edition as any)._count?.ticketingParticipants || 0
      return h('div', { class: 'flex items-center gap-1 text-sm' }, [
        h('UIcon', { name: 'i-heroicons-user-group', class: 'w-4 h-4 text-success-600' }),
        h('span', {}, count.toString()),
      ])
    },
  },
  {
    accessorKey: 'status',
    header: t('edition.status_label'),
    cell: ({ row }: TableCellParams) => {
      const edition = row.original
      const convention = myConventions.value.find((conv) =>
        conv.editions?.some((ed) => ed.id === edition.id)
      )
      const allowed = convention && canEditEdition(convention, edition.id)
      return h('div', { class: 'flex justify-center' }, [
        h(USelect, {
          modelValue: edition.status,
          items: editionStatusOptions.value,
          valueKey: 'value',
          size: 'xs',
          disabled: !allowed,
          ui: { content: 'min-w-fit' },
          'onUpdate:modelValue': (value: string) =>
            allowed &&
            updateEditionStatus(
              edition.id,
              value as 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
            ),
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

// Fonctions pour gérer les organisateurs
const openEditOrganizerModal = (convention: Convention, organizer: any) => {
  if (!canManageOrganizers(convention)) {
    toast.add({
      title: 'Action non autorisée',
      description: "Vous n'avez pas les droits pour modifier ce organisateur",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    return
  }

  selectedConventionForEdit.value = convention
  selectedOrganizerForEdit.value = organizer

  // Charger les droits actuels du organisateur
  editOrganizerRights.value = {
    title: organizer.title || '',
    rights: { ...organizer.rights },
    perEdition: [...(organizer.perEdition || [])],
  }

  editOrganizerModalOpen.value = true
}

const closeEditOrganizerModal = () => {
  editOrganizerModalOpen.value = false
  selectedConventionForEdit.value = null
  selectedOrganizerForEdit.value = null
  editOrganizerRights.value = {
    title: null,
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageOrganizers: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    perEdition: [],
  }
}

const saveOrganizerChanges = async () => {
  if (!selectedOrganizerForEdit.value || !selectedConventionForEdit.value) {
    return
  }

  try {
    savingOrganizer.value = true

    await $fetch(
      `/api/conventions/${selectedConventionForEdit.value.id}/organizers/${selectedOrganizerForEdit.value.id}`,
      {
        method: 'PUT',
        body: {
          rights: editOrganizerRights.value.rights,
          title: editOrganizerRights.value.title,
          perEdition: editOrganizerRights.value.perEdition || [],
        },
      }
    )

    toast.add({
      title: 'Droits mis à jour',
      description: 'Les droits du organisateur ont été modifiés avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal et recharger les conventions
    closeEditOrganizerModal()
    await fetchMyConventions()
  } catch (error: unknown) {
    const httpError = error as HttpError
    console.error('Error updating organizer rights:', error)
    toast.add({
      title: 'Erreur lors de la mise à jour',
      description: httpError.data?.message || httpError.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    savingOrganizer.value = false
  }
}

const openAddOrganizerModal = (convention: Convention) => {
  selectedConventionForAdd.value = convention
  // Réinitialiser les valeurs
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  newOrganizerRights.value = {
    title: null,
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageOrganizers: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    perEdition: [],
  }
  searchedUsers.value = []
  addOrganizerModalOpen.value = true
}

const closeAddOrganizerModal = () => {
  addOrganizerModalOpen.value = false
  selectedConventionForAdd.value = null
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  searchedUsers.value = []
}

const addOrganizer = async () => {
  if (!newOrganizerUser.value || !selectedConventionForAdd.value) {
    return
  }

  try {
    await $fetch(`/api/conventions/${selectedConventionForAdd.value.id}/organizers`, {
      method: 'POST',
      body: {
        userId: newOrganizerUser.value.id,
        rights: newOrganizerRights.value.rights,
        title: newOrganizerRights.value.title,
        perEdition: newOrganizerRights.value.perEdition || [],
      },
    })

    toast.add({
      title: 'Organisateur ajouté',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal et recharger les conventions
    closeAddOrganizerModal()
    await fetchMyConventions()
  } catch (error: unknown) {
    const httpError = error as HttpError
    console.error('Error adding organizer:', error)
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
    if (selectedConventionForEdit.value && editOrganizerModalOpen.value) {
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

// Helpers de droits (auteur ou admin actif = super droit implicite)
function currentUserId() {
  return authStore.user?.id
}
function findCurrentCollab(convention: Convention) {
  const uid = currentUserId()
  if (!uid) return undefined
  return convention.organizers?.find((c: any) => c.user.id === uid)
}
const isAuthor = (convention: Convention) =>
  currentUserId() && convention.authorId && convention.authorId === currentUserId()
const hasFullAccess = (convention: Convention) =>
  !!(isAuthor(convention) || authStore.isAdminModeActive)
const canManageOrganizers = (convention: Convention) =>
  !!(hasFullAccess(convention) || findCurrentCollab(convention)?.rights?.manageOrganizers)
const canAddEdition = (convention: Convention) =>
  !!(hasFullAccess(convention) || findCurrentCollab(convention)?.rights?.addEdition)
const canEditConvention = (convention: Convention) =>
  !!(hasFullAccess(convention) || findCurrentCollab(convention)?.rights?.editConvention)
const canDeleteConvention = (convention: Convention) =>
  !!(hasFullAccess(convention) || findCurrentCollab(convention)?.rights?.deleteConvention)
const canEditEdition = (convention: Convention, editionId: number) => {
  if (hasFullAccess(convention)) return true
  const collab = findCurrentCollab(convention)
  if (!collab) return false
  if (collab.rights?.editAllEditions) return true
  return (collab as any).perEdition?.some((p: any) => p.editionId === editionId && p.canEdit)
}
const canDeleteEdition = (convention: Convention, editionId: number) => {
  if (hasFullAccess(convention)) return true
  const collab = findCurrentCollab(convention)
  if (!collab) return false
  if (collab.rights?.deleteAllEditions) return true
  return (collab as any).perEdition?.some((p: any) => p.editionId === editionId && p.canDelete)
}

// Fonction pour obtenir le nom d'affichage d'une édition
const getEditionDisplayName = (edition: Edition) => {
  const convention = myConventions.value.find((conv) =>
    conv.editions?.some((ed) => ed.id === edition.id)
  )
  return getEditionDisplayNameWithConvention(edition, convention)
}

// Update edition status
const updateEditionStatus = async (
  editionId: number,
  status: 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
) => {
  try {
    await $fetch(`/api/editions/${editionId}/status`, {
      method: 'PATCH',
      body: { status },
    })

    toast.add({
      title: t('edition.status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Reload conventions to update the status
    await fetchMyConventions()
  } catch (error) {
    console.error('Failed to update edition status:', error)
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
