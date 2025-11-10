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

        <!-- Card d'ajout ou d'édition -->
        <UCard v-if="isAddingOrganizer || selectedOrganizer">
          <div class="space-y-4">
            <!-- En-tête -->
            <div
              class="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="
                    isAddingOrganizer ? 'i-heroicons-plus-circle' : 'i-heroicons-pencil-square'
                  "
                  class="text-primary-500"
                />
                <h3 class="text-lg font-semibold">
                  {{
                    isAddingOrganizer
                      ? $t('conventions.add_organizer')
                      : $t('gestion.organizers.edit_organizer')
                  }}
                </h3>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="cancelEditing"
              />
            </div>

            <!-- Formulaire d'ajout -->
            <div v-if="isAddingOrganizer" class="space-y-4">
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
                  :placeholder="$t('conventions.search_user_placeholder')"
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

              <!-- Actions -->
              <div
                class="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700"
              >
                <UButton variant="ghost" @click="cancelEditing">
                  {{ $t('common.cancel') }}
                </UButton>
                <UButton color="primary" :disabled="!newOrganizerUser" @click="addOrganizer">
                  {{ $t('common.add') }}
                </UButton>
              </div>
            </div>

            <!-- Formulaire d'édition -->
            <div v-else-if="selectedOrganizer" class="space-y-4">
              <!-- Info organisateur -->
              <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <UiUserAvatar :user="selectedOrganizer.user" size="md" />
                <div>
                  <div class="font-medium">{{ selectedOrganizer.user?.pseudo }}</div>
                  <div class="text-sm text-gray-500">{{ selectedOrganizer.user?.email }}</div>
                </div>
              </div>

              <!-- Configuration des droits -->
              <div>
                <OrganizerRightsFields
                  v-model="editOrganizerRights"
                  :editions="(conventionEditions || []) as any[]"
                  :convention-name="edition?.convention?.name"
                  size="sm"
                />
              </div>

              <!-- Actions -->
              <div class="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <UButton color="error" variant="soft" @click="removeOrganizer">
                  {{ $t('common.remove') }}
                </UButton>
                <div class="flex gap-3">
                  <UButton variant="ghost" @click="cancelEditing">
                    {{ $t('common.cancel') }}
                  </UButton>
                  <UButton color="primary" :loading="savingOrganizer" @click="saveOrganizerChanges">
                    {{ $t('common.save') }}
                  </UButton>
                </div>
              </div>
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

                <!-- Colonne Actions -->
                <template #actions-cell="{ row }">
                  <div class="flex items-center justify-end">
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="xs"
                      @click="removeFromEdition(row.original.id)"
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

        <!-- Card d'ajout ou d'édition -->
        <UCard v-if="isAddingOrganizer || selectedOrganizer">
          <div class="space-y-4">
            <!-- En-tête -->
            <div
              class="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="
                    isAddingOrganizer ? 'i-heroicons-plus-circle' : 'i-heroicons-pencil-square'
                  "
                  class="text-primary-500"
                />
                <h3 class="text-lg font-semibold">
                  {{
                    isAddingOrganizer
                      ? $t('conventions.add_organizer')
                      : $t('gestion.organizers.edit_organizer')
                  }}
                </h3>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="cancelEditing"
              />
            </div>

            <!-- Formulaire d'ajout -->
            <div v-if="isAddingOrganizer" class="space-y-4">
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
                  :placeholder="$t('conventions.search_user_placeholder')"
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

              <!-- Actions -->
              <div
                class="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700"
              >
                <UButton variant="ghost" @click="cancelEditing">
                  {{ $t('common.cancel') }}
                </UButton>
                <UButton color="primary" :disabled="!newOrganizerUser" @click="addOrganizer">
                  {{ $t('common.add') }}
                </UButton>
              </div>
            </div>

            <!-- Formulaire d'édition -->
            <div v-else-if="selectedOrganizer" class="space-y-4">
              <!-- Info organisateur -->
              <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <UiUserAvatar :user="selectedOrganizer.user" size="md" />
                <div>
                  <div class="font-medium">{{ selectedOrganizer.user?.pseudo }}</div>
                  <div class="text-sm text-gray-500">{{ selectedOrganizer.user?.email }}</div>
                </div>
              </div>

              <!-- Configuration des droits -->
              <div>
                <OrganizerRightsFields
                  v-model="editOrganizerRights"
                  :editions="(conventionEditions || []) as any[]"
                  :convention-name="edition?.convention?.name"
                  size="sm"
                />
              </div>

              <!-- Actions -->
              <div class="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <UButton color="error" variant="soft" @click="removeOrganizer">
                  {{ $t('common.remove') }}
                </UButton>
                <div class="flex gap-3">
                  <UButton variant="ghost" @click="cancelEditing">
                    {{ $t('common.cancel') }}
                  </UButton>
                  <UButton color="primary" :loading="savingOrganizer" @click="saveOrganizerChanges">
                    {{ $t('common.save') }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
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

definePageMeta({
  layout: 'edition-dashboard',
})

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

const editOrganizerRights = ref({
  rights: {},
  title: '',
  perEdition: [],
})

// Debounce pour la recherche d'utilisateurs
const debouncedSearchTerm = useDebounce(newOrganizersearchTerm, 300)

// Watchers pour la recherche d'utilisateurs
watch(debouncedSearchTerm, async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) {
    searchedUsers.value = []
    return
  }

  searchingUsers.value = true
  try {
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      params: { q: searchTerm },
    })
    searchedUsers.value = response.users
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
  isAddingOrganizer.value = false
  selectedOrganizer.value = organizer
  editOrganizerRights.value = {
    rights: organizer.rights || {},
    title: organizer.title || '',
    perEdition: organizer.perEditionRights || [],
  }
}

const cancelEditing = () => {
  isAddingOrganizer.value = false
  selectedOrganizer.value = null
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  searchedUsers.value = []
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

const saveOrganizerChanges = async () => {
  if (!selectedOrganizer.value || !edition.value) {
    return
  }

  savingOrganizer.value = true
  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/organizers/${selectedOrganizer.value.id}`,
      {
        method: 'PATCH',
        body: {
          rights: editOrganizerRights.value.rights,
          title: editOrganizerRights.value.title,
          perEdition: editOrganizerRights.value.perEdition,
        },
      }
    )

    toast.add({
      title: t('gestion.organizers.organizer_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    cancelEditing()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error updating organizer:', error)
    toast.add({
      title: t('errors.update_organizer_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
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

    cancelEditing()
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

const removeFromEdition = async (editionOrganizerId: number) => {
  if (!confirm(t('gestion.organizers.confirm_remove_from_edition'))) {
    return
  }

  try {
    await $fetch(`/api/editions/${editionId}/organizers/edition-organizers/${editionOrganizerId}`, {
      method: 'DELETE',
    })

    toast.add({
      title: t('gestion.organizers.removed_from_edition'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

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
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.organizers.title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.organizers.page_description'),
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
