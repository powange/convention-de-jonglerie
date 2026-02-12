<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="text-purple-500" />
          {{ $t('gestion.organizers.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.organizers.page_description') }}
        </p>
      </div>

      <!-- Contenu de gestion des organisateurs -->
      <div class="space-y-6">
        <!-- Liste des organisateurs -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-group" class="text-purple-500" />
                <h2 class="text-lg font-semibold">{{ $t('gestion.organizers.list') }}</h2>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  size="sm"
                  variant="ghost"
                  icon="i-heroicons-clock"
                  @click="openHistoryModal"
                >
                  {{ $t('conventions.history.title') }}
                </UButton>
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-plus"
                  @click="startAddingOrganizer"
                >
                  {{ $t('common.add') }}
                </UButton>
              </div>
            </div>

            <!-- Liste des organisateurs -->
            <div v-if="edition.convention?.organizers && edition.convention.organizers.length > 0">
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="organizer in edition.convention?.organizers"
                  :key="organizer.id"
                  :color="
                    selectedOrganizer?.id === organizer.id
                      ? 'primary'
                      : getOrganizerBadgeColor(organizer)
                  "
                  :variant="selectedOrganizer?.id === organizer.id ? 'solid' : 'subtle'"
                  class="flex items-center gap-2 cursor-pointer hover:bg-opacity-80 transition-colors"
                  @click="selectOrganizer(organizer)"
                >
                  <div class="flex items-center gap-1.5">
                    <UiUserAvatar :user="organizer.user" size="sm" />
                    <span>{{ organizer.user?.pseudo || '' }}</span>
                    <span
                      v-if="organizer.title && organizer.title.trim()"
                      class="text-xs opacity-75"
                    >
                      ({{ organizer.title.trim() }})
                    </span>
                  </div>
                </UBadge>
              </div>
            </div>
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-user-group" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('gestion.organizers.no_organizers') }}</p>
            </div>
          </div>
        </UCard>

        <!-- Organisateurs présents sur l'édition -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar-days" class="text-indigo-500" />
                <h2 class="text-lg font-semibold">
                  {{ $t('gestion.organizers.present_on_edition') }}
                </h2>
              </div>
              <UBadge v-if="editionOrganizers.length > 0" color="indigo" variant="soft">
                {{ editionOrganizers.length }}
              </UBadge>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('gestion.organizers.present_on_edition_description') }}
            </p>

            <!-- Liste des organisateurs présents -->
            <div v-if="loadingEditionOrganizers" class="text-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
            </div>
            <div v-else-if="editionOrganizers.length > 0">
              <UTable
                :data="editionOrganizers"
                :columns="editionOrganizersColumns"
                class="border border-accented"
              >
                <!-- Colonne Organisateur avec avatar et nom -->
                <template #organizer-cell="{ row }">
                  <div class="flex items-center gap-3">
                    <UiUserAvatar :user="row.original.user" size="sm" />
                    <div>
                      <div class="font-medium text-sm">
                        {{ row.original.user?.prenom }} {{ row.original.user?.nom }}
                      </div>
                      <div v-if="row.original.title" class="text-xs text-gray-500">
                        {{ row.original.title }}
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Colonne Statut -->
                <template #status-cell="{ row }">
                  <UBadge
                    v-if="row.original.entryValidated"
                    color="success"
                    variant="soft"
                    size="sm"
                  >
                    <div class="flex items-center gap-1">
                      <UIcon name="i-heroicons-check-circle" class="w-3 h-3" />
                      <span>{{ $t('gestion.organizers.entry_validated') }}</span>
                    </div>
                  </UBadge>
                  <UBadge v-else color="neutral" variant="soft" size="sm">
                    {{ $t('gestion.organizers.entry_not_validated') }}
                  </UBadge>
                </template>

                <!-- Colonne Articles -->
                <template #articles-cell="{ row }">
                  <div class="space-y-2">
                    <!-- Liste des articles spécifiques assignés (sans les globaux) -->
                    <div
                      v-if="getOrganizerItems(row.original.id).length > 0"
                      class="flex flex-wrap gap-1"
                    >
                      <UBadge
                        v-for="item in getOrganizerItems(row.original.id)"
                        :key="item.id"
                        color="amber"
                        variant="soft"
                        size="xs"
                      >
                        {{ item.returnableItemName }}
                      </UBadge>
                    </div>

                    <!-- Bouton gérer -->
                    <UButton
                      icon="i-heroicons-gift"
                      color="primary"
                      variant="ghost"
                      size="xs"
                      @click="openReturnableItemsModal(row.original)"
                    >
                      {{ $t('gestion.organizers.manage_articles') }}
                    </UButton>
                  </div>
                </template>

                <!-- Colonne Actions -->
                <template #actions-cell="{ row }">
                  <div class="flex items-center justify-end">
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="xs"
                      @click="confirmRemoveFromEdition(row.original)"
                    />
                  </div>
                </template>
              </UTable>
            </div>
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-user-group" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">
                {{ $t('gestion.organizers.no_organizers_on_edition') }}
              </p>
            </div>

            <!-- Ajouter un organisateur -->
            <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div v-if="availableOrganizers.length > 0" class="flex items-center gap-3">
                <USelect
                  v-model="selectedAvailableOrganizer"
                  :items="availableOrganizersOptions"
                  :placeholder="$t('gestion.organizers.select_to_add')"
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  color="primary"
                  size="sm"
                  icon="i-heroicons-plus"
                  :disabled="!selectedAvailableOrganizer"
                  @click="addToEdition"
                >
                  {{ $t('common.add') }}
                </UButton>
              </div>
              <div v-else class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                {{ $t('gestion.organizers.all_organizers_added') }}
              </div>
            </div>
          </div>
        </UCard>

        <!-- Articles globaux pour tous les organisateurs -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-gift" class="text-orange-500" />
                <h2 class="text-lg font-semibold">
                  {{ $t('gestion.organizers.global_returnable_items') }}
                </h2>
              </div>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-pencil"
                @click="openGlobalReturnableItemsModal"
              >
                {{ $t('common.edit') }}
              </UButton>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('gestion.organizers.global_returnable_items_description') }}
            </p>

            <!-- Liste des articles globaux -->
            <div v-if="loadingGlobalReturnableItems" class="text-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
            </div>
            <div v-else-if="globalReturnableItems.length > 0">
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="item in globalReturnableItems"
                  :key="item.id"
                  color="warning"
                  variant="soft"
                >
                  {{ item.returnableItemName }}
                </UBadge>
              </div>
            </div>
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-gift" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">
                {{ $t('gestion.organizers.no_global_returnable_items') }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal d'ajout d'organisateur -->
    <UModal v-model:open="isAddingOrganizer" :title="$t('conventions.add_organizer')" size="lg">
      <template #body>
        <div class="space-y-4">
          <!-- Recherche utilisateur -->
          <div>
            <label class="block text-sm font-medium mb-2">
              {{ $t('conventions.select_user') }}
            </label>
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
            <OrganizerRightsFields
              v-model="newOrganizerRights"
              :editions="(conventionEditions || []) as any[]"
              :convention-name="edition?.convention?.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="cancelEditing">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newOrganizerUser" @click="addOrganizer">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal d'édition d'organisateur -->
    <ConventionOrganizerEditModal
      v-model:open="editOrganizerModalOpen"
      :organizer="selectedOrganizer"
      :convention="edition?.convention || null"
      :editions="(conventionEditions || []) as any[]"
      :loading="savingOrganizer"
      @save="saveOrganizerChanges"
      @delete="removeOrganizer"
    />

    <!-- Modal d'historique -->
    <UModal
      v-model:open="historyModalOpen"
      :title="
        edition?.convention?.name
          ? $t('conventions.history.title_full', { name: edition.convention.name })
          : $t('conventions.history.title')
      "
      size="lg"
    >
      <template #body>
        <div v-if="edition?.convention?.id">
          <ConventionOrganizerHistory :convention-id="edition.convention.id" />
        </div>
      </template>
    </UModal>

    <!-- Modal de gestion des articles à restituer -->
    <OrganizersManageReturnableItemsModal
      v-model:open="returnableItemsModalOpen"
      :edition-id="editionId"
      :organizer="selectedOrganizerForItems"
      @items-updated="onItemsUpdated"
    />

    <!-- Modal de confirmation de suppression d'un organisateur de l'édition -->
    <UiConfirmModal
      v-model="removeFromEditionConfirmOpen"
      :title="$t('common.remove')"
      :description="
        organizerToRemoveFromEdition
          ? `${$t('gestion.organizers.confirm_remove_from_edition')}\n${organizerToRemoveFromEdition.name}`
          : ''
      "
      :confirm-label="$t('common.remove')"
      confirm-color="error"
      confirm-icon="i-heroicons-trash"
      icon-name="i-heroicons-exclamation-triangle"
      icon-color="text-red-500"
      @confirm="removeFromEdition"
      @cancel="removeFromEditionConfirmOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useDebounce } from '~/composables/useDebounce'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { summarizeRights } from '~/utils/organizerRights'

import type { TableColumn } from '@nuxt/ui'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Récupérer toutes les éditions de la convention pour la gestion des droits par édition
const conventionEditions = computed(() => {
  if (!edition.value?.conventionId) return []
  return editionStore.editions.filter((e) => e.conventionId === edition.value?.conventionId)
})

// État pour la gestion des organisateurs
const isAddingOrganizer = ref(false)
const selectedOrganizer = ref<any>(null)
const newOrganizerUser = ref<any>(null)
const newOrganizersearchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)
const savingOrganizer = ref(false)

// État pour la gestion des organisateurs sur l'édition
const editionOrganizers = ref<any[]>([])
const availableOrganizers = ref<any[]>([])
const loadingEditionOrganizers = ref(false)
const selectedAvailableOrganizer = ref<number | null>(null)

// État pour la modal d'historique
const historyModalOpen = ref(false)

// État pour la modal d'édition d'organisateur
const editOrganizerModalOpen = ref(false)

// État pour la gestion des articles à restituer
const globalReturnableItems = ref<any[]>([])
const loadingGlobalReturnableItems = ref(false)
const returnableItemsModalOpen = ref(false)
const selectedOrganizerForItems = ref<any>(null)
const organizerReturnableItems = ref<any[]>([]) // Tous les articles assignés (par organisateur et globaux)

// État pour la confirmation de suppression d'un organisateur de l'édition
const removeFromEditionConfirmOpen = ref(false)
const organizerToRemoveFromEdition = ref<{ id: number; name: string } | null>(null)

const newOrganizerRights = ref({
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageOrganizers: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
    manageMeals: false,
    manageTicketing: false,
  },
  title: '',
  perEdition: [],
})

// Debounce pour la recherche d'utilisateurs
const debouncedSearchTerm = useDebounce(newOrganizersearchTerm, 300)

// Watchers pour la recherche d'utilisateurs par email exact
watch(debouncedSearchTerm, async (searchTerm) => {
  // Validation basique d'email
  if (!searchTerm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchTerm)) {
    searchedUsers.value = []
    return
  }

  searchingUsers.value = true
  try {
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      params: { emailExact: searchTerm },
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
})

// Fonctions pour gérer les organisateurs
const getOrganizerBadgeColor = (organizer: any) => {
  const summary = summarizeRights(organizer)
  return summary.color === 'warning' ? 'error' : summary.color
}

const startAddingOrganizer = () => {
  selectedOrganizer.value = null
  isAddingOrganizer.value = true
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  newOrganizerRights.value = {
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageOrganizers: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
      manageMeals: false,
      manageTicketing: false,
    },
    title: '',
    perEdition: [],
  }
  searchedUsers.value = []
}

const selectOrganizer = (organizer: any) => {
  selectedOrganizer.value = organizer
  editOrganizerModalOpen.value = true
}

const cancelEditing = () => {
  isAddingOrganizer.value = false
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  searchedUsers.value = []
}

const closeEditOrganizerModal = () => {
  editOrganizerModalOpen.value = false
  selectedOrganizer.value = null
}

const addOrganizer = async () => {
  if (!newOrganizerUser.value || !edition.value) {
    return
  }

  try {
    await $fetch(`/api/conventions/${edition.value.convention?.id}/organizers`, {
      method: 'POST',
      body: {
        userId: newOrganizerUser.value.id,
        rights: newOrganizerRights.value.rights,
        title: newOrganizerRights.value.title,
        perEdition: newOrganizerRights.value.perEdition || [],
      },
    })

    toast.add({
      title: t('gestion.organizers.organizer_added'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    cancelEditing()
    // Recharger l'édition pour mettre à jour la liste des organisateurs
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error adding organizer:', error)
    toast.add({
      title: t('errors.add_organizer_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const saveOrganizerChanges = async (rights: OrganizerRightsFormData) => {
  if (!selectedOrganizer.value || !edition.value) {
    return
  }

  const { handleError } = useErrorHandler()
  savingOrganizer.value = true

  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/organizers/${selectedOrganizer.value.id}`,
      {
        method: 'PATCH',
        body: {
          rights: rights.rights,
          title: rights.title,
          perEdition: rights.perEdition,
        },
      }
    )

    toast.add({
      title: t('gestion.organizers.organizer_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditOrganizerModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: unknown) {
    handleError(error, {
      defaultTitleKey: 'errors.update_organizer_error',
      logPrefix: 'Error updating organizer',
    })
  } finally {
    savingOrganizer.value = false
  }
}

const removeOrganizer = async () => {
  if (!selectedOrganizer.value || !edition.value) {
    return
  }

  if (!confirm(t('gestion.organizers.confirm_remove'))) {
    return
  }

  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/organizers/${selectedOrganizer.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('gestion.organizers.organizer_removed'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditOrganizerModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error removing organizer:', error)
    toast.add({
      title: t('errors.remove_organizer_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) {
    return true
  }

  // Utilisateurs avec permission de gérer les organisateurs
  if (canManageOrganizers.value) {
    return true
  }

  return false
})

// Permissions calculées
const canManageOrganizers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageOrganizers(edition.value, authStore.user.id)
})

// Computed pour les options du select d'organisateurs disponibles
const availableOrganizersOptions = computed(() => {
  return availableOrganizers.value.map((organizer) => ({
    label:
      `${organizer.user?.prenom || ''} ${organizer.user?.nom || ''} ${organizer.title ? `(${organizer.title})` : ''}`.trim(),
    value: organizer.id,
  }))
})

// Colonnes de la table des organisateurs d'édition
const editionOrganizersColumns = computed((): TableColumn<any>[] => [
  {
    id: 'organizer',
    header: t('gestion.organizers.organizer'),
    size: 300,
  },
  {
    id: 'status',
    header: t('gestion.organizers.status'),
    size: 150,
  },
  {
    id: 'articles',
    header: t('gestion.organizers.returnable_items'),
    size: 200,
  },
  {
    id: 'actions',
    header: t('common.actions'),
    size: 100,
  },
])

// Fonctions pour gérer les organisateurs d'édition
const loadEditionOrganizers = async () => {
  loadingEditionOrganizers.value = true
  try {
    const [editionOrgsResult, availableOrgsResult] = await Promise.all([
      $fetch<{ organizers: any[] }>(`/api/editions/${editionId}/organizers/edition-organizers`),
      $fetch<{ organizers: any[] }>(`/api/editions/${editionId}/organizers/available`),
    ])

    editionOrganizers.value = editionOrgsResult.organizers || []
    availableOrganizers.value = availableOrgsResult.organizers || []
  } catch (error) {
    console.error('Failed to load edition organizers:', error)
    toast.add({
      title: t('errors.loading_error'),
      description: t('gestion.organizers.load_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loadingEditionOrganizers.value = false
  }
}

const addToEdition = async () => {
  if (!selectedAvailableOrganizer.value) return

  try {
    await $fetch(`/api/editions/${editionId}/organizers/edition-organizers`, {
      method: 'POST',
      body: {
        organizerId: selectedAvailableOrganizer.value,
      },
    })

    toast.add({
      title: t('gestion.organizers.added_to_edition'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    selectedAvailableOrganizer.value = null
    await loadEditionOrganizers()
  } catch (error: any) {
    console.error('Failed to add organizer to edition:', error)
    toast.add({
      title: t('errors.add_error'),
      description: error.data?.message || t('gestion.organizers.add_to_edition_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const confirmRemoveFromEdition = (organizer: any) => {
  const user = organizer.user
  const displayName = user?.pseudo || `${user?.prenom || ''} ${user?.nom || ''}`.trim()
  organizerToRemoveFromEdition.value = {
    id: organizer.id,
    name: displayName,
  }
  removeFromEditionConfirmOpen.value = true
}

const removeFromEdition = async () => {
  if (!organizerToRemoveFromEdition.value) return

  try {
    await $fetch(
      `/api/editions/${editionId}/organizers/edition-organizers/${organizerToRemoveFromEdition.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('gestion.organizers.removed_from_edition'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    removeFromEditionConfirmOpen.value = false
    organizerToRemoveFromEdition.value = null
    await loadEditionOrganizers()
  } catch (error: any) {
    console.error('Failed to remove organizer from edition:', error)
    toast.add({
      title: t('errors.remove_error'),
      description: error.data?.message || t('gestion.organizers.remove_from_edition_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Fonction pour ouvrir la modal d'historique
const openHistoryModal = () => {
  historyModalOpen.value = true
}

// Fonctions pour gérer les articles à restituer
const loadGlobalReturnableItems = async () => {
  loadingGlobalReturnableItems.value = true
  try {
    const response = await $fetch(
      `/api/editions/${editionId}/ticketing/organizers/returnable-items`
    )

    const allItems = response.items || []
    // Stocker TOUS les articles (globaux + spécifiques)
    organizerReturnableItems.value = allItems
    // Filtrer pour ne garder que les articles globaux (organizerId = null)
    globalReturnableItems.value = allItems.filter((item: any) => item.organizerId === null)
  } catch (error) {
    console.error('Erreur lors du chargement des articles globaux:', error)
    toast.add({
      title: t('common.error'),
      description: t('gestion.organizers.error_loading_items'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loadingGlobalReturnableItems.value = false
  }
}

// Obtenir les articles spécifiques d'un organisateur (sans les globaux)
const getOrganizerItems = (organizerId: number) => {
  return organizerReturnableItems.value.filter((item: any) => item.organizerId === organizerId)
}

const openReturnableItemsModal = (organizer: any) => {
  selectedOrganizerForItems.value = organizer
  returnableItemsModalOpen.value = true
}

const openGlobalReturnableItemsModal = () => {
  selectedOrganizerForItems.value = null
  returnableItemsModalOpen.value = true
}

const onItemsUpdated = async () => {
  // Recharger tous les articles après modification
  await loadGlobalReturnableItems()
}

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les organisateurs de l'édition
  await loadEditionOrganizers()

  // Charger les articles à restituer globaux
  await loadGlobalReturnableItems()
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.organizers.title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.organizers.page_description'),
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
