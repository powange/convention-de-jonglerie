<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('components.collaborators_modal.title')"
    close-icon="i-heroicons-x-mark-20-solid"
  >
    <template #body>
      <div class="space-y-8">
        <!-- Section expérimentale gestion des droits granulaires -->
        <details
          v-if="props.convention"
          class="border border-amber-300/60 dark:border-amber-600/40 rounded p-3 bg-amber-50/60 dark:bg-amber-900/20"
        >
          <summary
            class="cursor-pointer text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2"
          >
            <UIcon name="i-heroicons-beaker" />
            {{ $t('components.collaborators_rights_panel.title') }}
          </summary>
          <div class="mt-3">
            <CollaboratorsRightsPanel :convention-id="props.convention?.id || null" />
          </div>
        </details>

        <!-- Liste des collaborateurs -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('components.collaborators_modal.current_collaborators') }} ({{
                collaborators.length
              }})
            </h4>
            <UButton
              size="xs"
              variant="outline"
              icon="i-heroicons-arrow-path"
              :loading="collaboratorsLoading"
              @click="fetchCollaborators"
              >{{ $t('components.collaborators_modal.refresh') }}</UButton
            >
          </div>
          <div v-if="collaboratorsLoading" class="text-center py-6 text-sm text-gray-500">
            {{ $t('common.loading') }}
          </div>
          <div v-else-if="!collaborators.length" class="text-sm text-gray-500 italic">
            {{ $t('components.collaborators_modal.no_collaborators') }}
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="c in collaborators"
              :key="c.id"
              class="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded p-3 bg-white/60 dark:bg-gray-900/40"
            >
              <div class="flex items-center gap-3 min-w-0">
                <UserAvatar :user="c.user" size="md" />
                <div class="min-w-0">
                  <p class="text-sm font-medium flex items-center gap-2">
                    <span class="truncate max-w-[160px]" :title="c.user.pseudo">{{
                      c.user.pseudo
                    }}</span>
                    <UBadge
                      v-if="c.rights"
                      :color="
                        c.rights.manageCollaborators
                          ? 'warning'
                          : c.rights.editConvention
                            ? 'info'
                            : 'neutral'
                      "
                      size="xs"
                      variant="subtle"
                    >
                      {{
                        c.rights.manageCollaborators
                          ? $t('permissions.admin')
                          : c.rights.editConvention
                            ? $t('permissions.moderator')
                            : $t('permissions.viewer')
                      }}
                    </UBadge>
                  </p>
                  <p
                    v-if="c.title"
                    class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]"
                  >
                    {{ c.title }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  v-if="c.user.id !== currentUserId"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  :aria-label="$t('common.delete')"
                  @click="handleRemoveCollaborator(c.id)"
                />
              </div>
            </li>
          </ul>
        </div>

        <!-- Ajout collaborateur (droits granulaires) -->
        <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            {{ $t('components.collaborators_modal.add_collaborator') }}
          </h4>
          <div class="space-y-4">
            <UInputMenu
              v-model="selectedUser"
              v-model:search="searchTerm"
              :items="userItems"
              :avatar="selectedUser?.avatar"
              :placeholder="$t('components.collaborators_modal.search_user_placeholder')"
              :loading="searchLoading"
              size="lg"
            />
            <div class="grid grid-cols-2 gap-3 text-xs">
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.editConvention" />
                <span>{{ $t('permissions.edit_convention') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.deleteConvention" />
                <span>{{ $t('permissions.delete_convention') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.manageCollaborators" />
                <span>{{ $t('permissions.manage_collaborators') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.addEdition" />
                <span>{{ $t('permissions.add_edition') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.editAllEditions" />
                <span>{{ $t('permissions.edit_all_editions') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="newRights.deleteAllEditions" />
                <span>{{ $t('permissions.delete_all_editions') }}</span>
              </label>
            </div>
            <div class="flex flex-col gap-2">
              <UInput
                v-model="newCollaboratorTitle"
                :placeholder="$t('components.collaborators_modal.optional_title_placeholder')"
                size="sm"
              />
              <div class="flex justify-end">
                <UButton
                  :disabled="!selectedUser || loading"
                  :loading="loading"
                  icon="i-heroicons-plus"
                  :label="t('common.add')"
                  color="primary"
                  @click="handleAddCollaborator"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UserAvatar from '~/components/ui/UserAvatar.vue'
import type { Convention } from '~/types'

import type { InputMenuItem } from '@nuxt/ui'

interface Props {
  modelValue: boolean
  convention: Convention | null
  currentUserId?: number
}
type UserItem = InputMenuItem & {
  value: number
  label: string
  avatar?: { src: string; alt: string }
  user: { id: number; pseudo: string; profilePicture?: string; emailHash?: string }
}
interface CollaboratorItem {
  id: number
  user: { id: number; pseudo: string }
  title?: string | null
  rights?: Record<string, boolean>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'collaborator-added' | 'collaborator-removed'): void
}>()

const { normalizeImageUrl } = useImageUrl()
const toast = useToast()
const { t } = useI18n()

const selectedUser = ref<UserItem | undefined>(undefined)
const searchTerm = ref('')
// Champ legacy (sélection d'un rôle) supprimé: on gardera bientôt un formulaire de droits granulaires direct.
// Formulaire nouveaux droits
const newRights = reactive<{ [k: string]: boolean }>({
  editConvention: false,
  deleteConvention: false,
  manageCollaborators: false,
  addEdition: false,
  editAllEditions: false,
  deleteAllEditions: false,
})
const newCollaboratorTitle = ref<string>('')
const loading = ref(false)
const searchLoading = ref(false)
const userItems = ref<UserItem[]>([])
const collaborators = ref<CollaboratorItem[]>([])
const collaboratorsLoading = ref(false)

// Modal open state
const isOpen = computed<boolean>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// Ancien sélecteur de rôles supprimé (remplacé par droits granularisés)

async function fetchCollaborators() {
  if (!props.convention) return
  collaboratorsLoading.value = true
  try {
    const data = await $fetch<CollaboratorItem[]>(
      `/api/conventions/${props.convention.id}/collaborators`
    )
    collaborators.value = data
  } catch (e) {
    console.error(e)
  } finally {
    collaboratorsLoading.value = false
  }
}

// Open watcher
watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await fetchCollaborators()
      // Reset add form
      selectedUser.value = undefined
      searchTerm.value = ''
  Object.keys(newRights).forEach((k) => (newRights[k] = false))
  newCollaboratorTitle.value = ''
      userItems.value = []
    }
  }
)

// User search
watch(searchTerm, (q) => {
  debouncedSearch(q)
})

const searchUsers = async (query: string) => {
  if (!query || query.length < 2) {
    userItems.value = []
    return
  }
  try {
    searchLoading.value = true
    const users = await $fetch<
      Array<{ id: number; pseudo: string; profilePicture?: string; emailHash?: string }>
    >('/api/users/search', { query: { q: query } })
    userItems.value = users.map((u) => ({
      value: u.id,
      label: u.pseudo,
      avatar: u.profilePicture
        ? { src: normalizeImageUrl(u.profilePicture) || '', alt: u.pseudo }
        : undefined,
      user: u,
    }))
  } catch {
    userItems.value = []
  } finally {
    searchLoading.value = false
  }
}

let searchTimeout: NodeJS.Timeout
function debouncedSearch(q: string) {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => searchUsers(q), 300)
}

// Add collaborator
async function handleAddCollaborator() {
  if (!props.convention || !selectedUser.value) return
  try {
    loading.value = true
    await $fetch(`/api/conventions/${props.convention.id}/collaborators`, {
      method: 'POST',
      body: {
        userId: selectedUser.value.value,
        rights: { ...newRights },
        title: newCollaboratorTitle.value || undefined,
      },
    })
    toast.add({
      title: t('messages.collaborator_added'),
      description: t('messages.collaborator_added_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('collaborator-added')
    await fetchCollaborators()
    // reset form
    selectedUser.value = undefined
    searchTerm.value = ''
  Object.keys(newRights).forEach((k) => (newRights[k] = false))
  newCollaboratorTitle.value = ''
    userItems.value = []
  } catch (error: any) {
    toast.add({
      title: t('errors.addition_error'),
      description: error?.data?.message || error?.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Remove collaborator
async function handleRemoveCollaborator(collaboratorId: number) {
  if (!props.convention) return
  if (!confirm(t('components.collaborators_modal.confirm_remove'))) return
  try {
    await $fetch(`/api/conventions/${props.convention.id}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('messages.collaborator_removed'),
      description: t('messages.collaborator_removed_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('collaborator-removed')
    await fetchCollaborators()
  } catch (error: any) {
    toast.add({
      title: t('errors.removal_error'),
      description: error?.data?.message || error?.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
