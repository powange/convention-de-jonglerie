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
          {{ $t('organizers.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('organizers.page_description') }}
        </p>
      </div>

      <!-- Contenu de gestion des organisateurs -->
      <div class="space-y-6">
        <!-- Organisateurs -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-group" class="text-purple-500" />
                <h2 class="text-lg font-semibold">{{ $t('organizers.list') }}</h2>
              </div>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-plus"
                @click="openAddOrganizerModal"
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
                  :color="getOrganizerBadgeColor(organizer)"
                  variant="subtle"
                  class="flex items-center gap-2 cursor-pointer hover:bg-opacity-80 transition-colors"
                  @click="openEditOrganizerModal(organizer)"
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
              <p class="text-sm text-gray-500">{{ $t('organizers.no_organizers') }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal d'ajout de organisateur -->
    <UModal v-model:open="addOrganizerModalOpen" :title="$t('conventions.add_organizer')" size="lg">
      <template #body>
        <div class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2">{{
                $t('conventions.select_user')
              }}</label>
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
              <label class="block text-sm font-medium mb-2">{{ $t('organizers.rights') }}</label>
              <OrganizerRightsFields
                v-model="newOrganizerRights"
                :editions="[edition] as any[]"
                :convention-name="edition?.convention?.name"
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

    <!-- Modal d'édition de organisateur -->
    <UModal
      v-model:open="editOrganizerModalOpen"
      :title="$t('organizers.edit_organizer')"
      size="lg"
    >
      <template #body>
        <div v-if="selectedOrganizer" class="space-y-4">
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
            <label class="block text-sm font-medium mb-2">{{ $t('organizers.rights') }}</label>
            <OrganizerRightsFields
              v-model="editOrganizerRights"
              :editions="[edition] as any[]"
              :convention-name="edition?.convention?.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between">
          <UButton color="error" variant="soft" @click="removeOrganizer">
            {{ $t('common.remove') }}
          </UButton>
          <div class="flex gap-3">
            <UButton variant="ghost" @click="closeEditOrganizerModal">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="savingOrganizer" @click="saveOrganizerChanges">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useDebounce } from '~/composables/useDebounce'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { summarizeRights } from '~/utils/organizerRights'

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

// État pour les modals de organisateurs
const addOrganizerModalOpen = ref(false)
const editOrganizerModalOpen = ref(false)
const selectedOrganizer = ref<any>(null)
const newOrganizerUser = ref<any>(null)
const newOrganizersearchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)
const savingOrganizer = ref(false)

const newOrganizerRights = ref({
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageOrganizers: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
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

const openAddOrganizerModal = () => {
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
    },
    title: '',
    perEdition: [],
  }
  searchedUsers.value = []
  addOrganizerModalOpen.value = true
}

const closeAddOrganizerModal = () => {
  addOrganizerModalOpen.value = false
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
      title: t('organizers.organizer_added'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeAddOrganizerModal()
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

const openEditOrganizerModal = (organizer: any) => {
  selectedOrganizer.value = organizer
  editOrganizerRights.value = {
    rights: organizer.rights || {},
    title: organizer.title || '',
    perEdition: organizer.perEditionRights || [],
  }
  editOrganizerModalOpen.value = true
}

const closeEditOrganizerModal = () => {
  editOrganizerModalOpen.value = false
  selectedOrganizer.value = null
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
      title: t('organizers.organizer_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditOrganizerModal()
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

  if (!confirm(t('organizers.confirm_remove'))) {
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
      title: t('organizers.organizer_removed'),
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

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Métadonnées de la page
useSeoMeta({
  title: t('organizers.title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('organizers.page_description'),
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
