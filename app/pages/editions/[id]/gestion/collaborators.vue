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
          {{ $t('collaborators.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('collaborators.page_description') }}
        </p>
      </div>

      <!-- Contenu de gestion des collaborateurs -->
      <div class="space-y-6">
        <!-- Collaborateurs -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-group" class="text-purple-500" />
                <h2 class="text-lg font-semibold">{{ $t('collaborators.list') }}</h2>
              </div>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-plus"
                @click="openAddCollaboratorModal"
              >
                {{ $t('common.add') }}
              </UButton>
            </div>

            <!-- Liste des collaborateurs -->
            <div
              v-if="
                edition.convention?.collaborators && edition.convention.collaborators.length > 0
              "
            >
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="collaborator in edition.convention?.collaborators"
                  :key="collaborator.id"
                  :color="getCollaboratorBadgeColor(collaborator)"
                  variant="subtle"
                  class="flex items-center gap-2 cursor-pointer hover:bg-opacity-80 transition-colors"
                  @click="openEditCollaboratorModal(collaborator)"
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
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-user-group" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('collaborators.no_collaborators') }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal d'ajout de collaborateur -->
    <UModal
      v-model:open="addCollaboratorModalOpen"
      :title="$t('conventions.add_collaborator')"
      size="lg"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2">{{
                $t('conventions.select_user')
              }}</label>
              <UserSelector
                v-model="newCollaboratorUser"
                v-model:search-term="newCollaboratorSearchTerm"
                :searched-users="searchedUsers"
                :searching-users="searchingUsers"
                :placeholder="$t('conventions.search_user_placeholder')"
              />
            </div>

            <!-- Configuration des droits -->
            <div v-if="newCollaboratorUser">
              <label class="block text-sm font-medium mb-2">{{ $t('collaborators.rights') }}</label>
              <CollaboratorRightsFields
                v-model="newCollaboratorRights"
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
          <UButton variant="ghost" @click="closeAddCollaboratorModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newCollaboratorUser" @click="addCollaborator">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal d'édition de collaborateur -->
    <UModal
      v-model:open="editCollaboratorModalOpen"
      :title="$t('collaborators.edit_collaborator')"
      size="lg"
    >
      <template #body>
        <div v-if="selectedCollaborator" class="space-y-4">
          <!-- Info collaborateur -->
          <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <UiUserAvatar :user="selectedCollaborator.user" size="md" />
            <div>
              <div class="font-medium">{{ selectedCollaborator.user?.pseudo }}</div>
              <div class="text-sm text-gray-500">{{ selectedCollaborator.user?.email }}</div>
            </div>
          </div>

          <!-- Configuration des droits -->
          <div>
            <label class="block text-sm font-medium mb-2">{{ $t('collaborators.rights') }}</label>
            <CollaboratorRightsFields
              v-model="editCollaboratorRights"
              :editions="[edition] as any[]"
              :convention-name="edition?.convention?.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between">
          <UButton color="error" variant="soft" @click="removeCollaborator">
            {{ $t('common.remove') }}
          </UButton>
          <div class="flex gap-3">
            <UButton variant="ghost" @click="closeEditCollaboratorModal">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="savingCollaborator" @click="saveCollaboratorChanges">
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
import { summarizeRights } from '~/utils/collaboratorRights'

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

// État pour les modals de collaborateurs
const addCollaboratorModalOpen = ref(false)
const editCollaboratorModalOpen = ref(false)
const selectedCollaborator = ref<any>(null)
const newCollaboratorUser = ref<any>(null)
const newCollaboratorSearchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)
const savingCollaborator = ref(false)

const newCollaboratorRights = ref({
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageCollaborators: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  title: '',
  perEdition: [],
})

const editCollaboratorRights = ref({
  rights: {},
  title: '',
  perEdition: [],
})

// Debounce pour la recherche d'utilisateurs
const debouncedSearchTerm = useDebounce(newCollaboratorSearchTerm, 300)

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

// Fonctions pour gérer les collaborateurs
const getCollaboratorBadgeColor = (collaborator: any) => {
  const summary = summarizeRights(collaborator)
  return summary.color === 'warning' ? 'error' : summary.color
}

const openAddCollaboratorModal = () => {
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  newCollaboratorRights.value = {
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageCollaborators: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    title: '',
    perEdition: [],
  }
  searchedUsers.value = []
  addCollaboratorModalOpen.value = true
}

const closeAddCollaboratorModal = () => {
  addCollaboratorModalOpen.value = false
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  searchedUsers.value = []
}

const addCollaborator = async () => {
  if (!newCollaboratorUser.value || !edition.value) {
    return
  }

  try {
    await $fetch(`/api/conventions/${edition.value.convention?.id}/collaborators`, {
      method: 'POST',
      body: {
        userId: newCollaboratorUser.value.id,
        rights: newCollaboratorRights.value.rights,
        title: newCollaboratorRights.value.title,
        perEdition: newCollaboratorRights.value.perEdition || [],
      },
    })

    toast.add({
      title: t('collaborators.collaborator_added'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeAddCollaboratorModal()
    // Recharger l'édition pour mettre à jour la liste des collaborateurs
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error adding collaborator:', error)
    toast.add({
      title: t('errors.add_collaborator_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const openEditCollaboratorModal = (collaborator: any) => {
  selectedCollaborator.value = collaborator
  editCollaboratorRights.value = {
    rights: collaborator.rights || {},
    title: collaborator.title || '',
    perEdition: collaborator.perEditionRights || [],
  }
  editCollaboratorModalOpen.value = true
}

const closeEditCollaboratorModal = () => {
  editCollaboratorModalOpen.value = false
  selectedCollaborator.value = null
}

const saveCollaboratorChanges = async () => {
  if (!selectedCollaborator.value || !edition.value) {
    return
  }

  savingCollaborator.value = true
  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/collaborators/${selectedCollaborator.value.id}`,
      {
        method: 'PATCH',
        body: {
          rights: editCollaboratorRights.value.rights,
          title: editCollaboratorRights.value.title,
          perEdition: editCollaboratorRights.value.perEdition,
        },
      }
    )

    toast.add({
      title: t('collaborators.collaborator_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditCollaboratorModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error updating collaborator:', error)
    toast.add({
      title: t('errors.update_collaborator_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    savingCollaborator.value = false
  }
}

const removeCollaborator = async () => {
  if (!selectedCollaborator.value || !edition.value) {
    return
  }

  if (!confirm(t('collaborators.confirm_remove'))) {
    return
  }

  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/collaborators/${selectedCollaborator.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('collaborators.collaborator_removed'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditCollaboratorModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error removing collaborator:', error)
    toast.add({
      title: t('errors.remove_collaborator_error'),
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

  // Utilisateurs avec permission de gérer les collaborateurs
  if (canManageCollaborators.value) {
    return true
  }

  return false
})

// Permissions calculées
const canManageCollaborators = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageCollaborators(edition.value, authStore.user.id)
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
  title: t('collaborators.title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('collaborators.page_description'),
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
