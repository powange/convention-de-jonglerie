<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('components.collaborators_modal.title')"
    :description="$t('components.collaborators_modal.description')"
    close-icon="i-heroicons-x-mark-20-solid"
  >
    <template #body>
      <div class="space-y-8">
        <!-- Panel droits expérimentaux -->
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
        <section>
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
              class="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white/60 dark:bg-gray-900/40"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
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
                  <UPopover v-if="c.perEdition && c.perEdition.length">
                    <UTooltip :text="$t('components.collaborators_rights_panel.per_edition')">
                      <UButton
                        size="xs"
                        variant="soft"
                        color="neutral"
                        icon="i-heroicons-clipboard-document-list"
                        :aria-label="$t('components.collaborators_rights_panel.per_edition')"
                      />
                    </UTooltip>
                    <template #panel>
                      <div class="p-2 max-h-52 overflow-y-auto text-[11px] space-y-1 w-56">
                        <div
                          v-for="p in c.perEdition"
                          :key="p.editionId"
                          class="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-1"
                        >
                          <span class="truncate" :title="'#' + p.editionId"
                            >#{{ p.editionId }}</span
                          >
                          <span class="flex gap-1">
                            <UBadge v-if="p.canEdit" size="xs" color="info" variant="subtle"
                              >E</UBadge
                            >
                            <UBadge v-if="p.canDelete" size="xs" color="error" variant="subtle"
                              >D</UBadge
                            >
                          </span>
                        </div>
                        <div v-if="!c.perEdition || !c.perEdition.length" class="italic opacity-60">
                          {{ $t('components.collaborators_rights_panel.no_editions') }}
                        </div>
                      </div>
                    </template>
                  </UPopover>
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-heroicons-pencil-square"
                    :aria-label="$t('components.collaborators_modal.edit_rights')"
                    @click="toggleEdit(c)"
                  />
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
              </div>
              <transition name="fade">
                <div
                  v-if="editingId === c.id && editForms[c.id]"
                  class="mt-4 border-t pt-4 space-y-3"
                >
                  <div class="grid grid-cols-2 gap-3 text-[11px]">
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.editConvention"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.editConvention = !!val)
                        "
                      />{{ $t('permissions.edit_convention') }}</label
                    >
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.deleteConvention"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.deleteConvention = !!val)
                        "
                      />{{ $t('permissions.delete_convention') }}</label
                    >
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.manageCollaborators"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.manageCollaborators = !!val)
                        "
                      />{{ $t('permissions.manage_collaborators') }}</label
                    >
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.addEdition"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.addEdition = !!val)
                        "
                      />{{ $t('permissions.add_edition') }}</label
                    >
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.editAllEditions"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.editAllEditions = !!val)
                        "
                      />{{ $t('permissions.edit_all_editions') }}</label
                    >
                    <label class="flex items-center gap-2"
                      ><UCheckbox
                        :model-value="getEditFormSafe(c.id).rights.deleteAllEditions"
                        @update:model-value="
                          (val) => (getEditFormSafe(c.id).rights.deleteAllEditions = !!val)
                        "
                      />{{ $t('permissions.delete_all_editions') }}</label
                    >
                  </div>
                  <UInput
                    :model-value="getEditFormSafe(c.id).title"
                    size="xs"
                    :placeholder="$t('components.collaborators_modal.optional_title_placeholder')"
                    @update:model-value="(val) => (getEditFormSafe(c.id).title = val)"
                  />
                  <div v-if="editions.length" class="border rounded p-2 space-y-2">
                    <p class="text-[11px] font-medium mb-1">
                      {{ $t('components.collaborators_rights_panel.per_edition') }}
                    </p>
                    <div class="space-y-1 max-h-48 overflow-y-auto pr-1">
                      <div
                        v-for="ed in editions"
                        :key="ed.id"
                        class="flex items-center justify-between gap-3 text-[11px] border-b last:border-b-0 border-gray-100 dark:border-gray-800 py-1"
                      >
                        <span class="truncate" :title="ed.name || '#' + ed.id">{{
                          ed.name || '#' + ed.id
                        }}</span>
                        <div class="flex items-center gap-3">
                          <label class="flex items-center gap-1">
                            <UCheckbox
                              :model-value="!!getEditFormSafe(c.id).perEdition[ed.id]?.canEdit"
                              size="xs"
                              :disabled="getEditFormSafe(c.id).rights.editAllEditions"
                              @update:model-value="
                                (val) => toggleEditPerEdition(c.id, ed.id, 'canEdit', !!val)
                              "
                            />
                            <UBadge size="xs" color="info" variant="subtle">E</UBadge>
                          </label>
                          <label class="flex items-center gap-1">
                            <UCheckbox
                              :model-value="!!getEditFormSafe(c.id).perEdition[ed.id]?.canDelete"
                              size="xs"
                              @update:model-value="
                                (val) => toggleEditPerEdition(c.id, ed.id, 'canDelete', !!val)
                              "
                            />
                            <UBadge size="xs" color="error" variant="subtle">D</UBadge>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 pt-2">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :disabled="updateLoading"
                      @click="cancelEdit()"
                      >{{ $t('common.cancel') }}</UButton
                    >
                    <UButton
                      size="xs"
                      color="primary"
                      :loading="updateLoading"
                      icon="i-heroicons-check"
                      @click="saveEdit(c)"
                      >{{ $t('common.save') }}</UButton
                    >
                  </div>
                </div>
              </transition>
            </li>
          </ul>
        </section>

        <!-- Ajout collaborateur -->
        <section class="pt-2 border-t border-gray-100 dark:border-gray-800">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            {{ $t('components.collaborators_modal.add_collaborator') }}
          </h4>
          <div class="space-y-4">
            <UInputMenu
              v-model="selectedUser"
              v-model:search-term="searchTerm"
              :items="userItems"
              :placeholder="$t('components.collaborators_modal.search_user_placeholder')"
              :loading="searchLoading"
              size="lg"
              ignore-filter
              @update:search-term="onSearchUpdate"
            >
              <template #leading="{ modelValue: currentValue }">
                <UAvatar v-if="currentValue?.avatar" v-bind="currentValue.avatar" size="xs" />
                <UIcon v-else name="i-heroicons-user-circle" class="text-gray-400" />
              </template>
              <template #item-leading="{ item }">
                <UAvatar v-if="item.avatar" v-bind="item.avatar" size="xs" />
                <UIcon v-else name="i-heroicons-user-circle" class="text-gray-400" />
              </template>
              <template #empty>
                <div class="py-4 text-center text-xs text-gray-500">
                  {{ searchTerm.length < 2 ? $t('common.start_typing') : $t('common.no_results') }}
                </div>
              </template>
            </UInputMenu>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.editConvention" />
                <span>{{ $t('permissions.edit_convention') }}</span></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.deleteConvention" />
                <span>{{ $t('permissions.delete_convention') }}</span></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.manageCollaborators" />
                <span>{{ $t('permissions.manage_collaborators') }}</span></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.addEdition" />
                <span>{{ $t('permissions.add_edition') }}</span></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.editAllEditions" />
                <span>{{ $t('permissions.edit_all_editions') }}</span></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="newRights.deleteAllEditions" />
                <span>{{ $t('permissions.delete_all_editions') }}</span></label
              >
            </div>

            <div
              v-if="editions.length"
              class="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium">{{
                  $t('components.collaborators_rights_panel.per_edition')
                }}</span>
                <UButton
                  v-if="Object.keys(newPerEdition).some((k) => newPerEdition[Number(k)])"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-x-mark"
                  @click="resetNewPerEdition"
                  >{{ $t('common.reset') }}</UButton
                >
              </div>
              <div
                v-if="!Object.keys(newPerEdition).some((k) => newPerEdition[Number(k)])"
                class="text-[11px] text-gray-500"
              >
                {{ $t('components.collaborators_modal.per_edition_hint') }}
              </div>
              <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div
                  v-for="ed in editions"
                  :key="ed.id"
                  class="flex flex-col gap-1 border border-gray-100 dark:border-gray-800 rounded p-2"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-medium truncate" :title="ed.name || '#' + ed.id">{{
                      ed.name || '#' + ed.id
                    }}</span>
                    <div class="flex items-center gap-3 text-[11px]">
                      <label class="flex items-center gap-1 cursor-pointer">
                        <UCheckbox
                          :model-value="!!newPerEdition[ed.id]?.canEdit"
                          size="sm"
                          :disabled="newRights.editAllEditions"
                          @update:model-value="
                            (val) => toggleNewPerEdition(ed.id, 'canEdit', !!val)
                          "
                        />
                        <span class="flex items-center gap-1"
                          ><UBadge size="xs" color="info" variant="subtle">E</UBadge
                          >{{ $t('components.collaborators_rights_panel.edit_short') }}</span
                        >
                      </label>
                      <label class="flex items-center gap-1 cursor-pointer">
                        <UCheckbox
                          :model-value="!!newPerEdition[ed.id]?.canDelete"
                          size="sm"
                          @update:model-value="
                            (val) => toggleNewPerEdition(ed.id, 'canDelete', !!val)
                          "
                        />
                        <span class="flex items-center gap-1"
                          ><UBadge size="xs" color="error" variant="subtle">D</UBadge
                          >{{ $t('components.collaborators_rights_panel.delete_short') }}</span
                        >
                      </label>
                    </div>
                  </div>
                </div>
              </div>
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
        </section>
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
  perEdition?: Array<{ editionId: number; canEdit?: boolean; canDelete?: boolean }>
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
// Editions pour ajout per-edition
const editions = ref<Array<{ id: number; name: string | null }>>([])
const newPerEdition = reactive<Record<number, { canEdit: boolean; canDelete: boolean }>>({})
// Edition existante
const editingId = ref<number | null>(null)
interface EditForm {
  title: string | null
  rights: {
    editConvention: boolean
    deleteConvention: boolean
    manageCollaborators: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
  }
  perEdition: Record<number, { canEdit: boolean; canDelete: boolean }>
}
const editForms = reactive<Record<number, EditForm>>({})
const updateLoading = ref(false)

// Helper pour le template (typage sûr après le guard v-if)
const getEditFormSafe = (id: number): EditForm => editForms[id] as EditForm

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
    // Charger les éditions si pas déjà
    if (!editions.value.length) {
      editions.value = await $fetch(`/api/conventions/${props.convention.id}/editions`)
    }
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
      newPerEditionKeysReset()
    }
  }
)

// Si "éditer toutes les éditions" est activé, on supprime les flags canEdit par édition (inutile & éviter confusion)
watch(
  () => newRights.editAllEditions,
  (val) => {
    if (val) {
      for (const k in newPerEdition) {
        if (newPerEdition[k]) {
          newPerEdition[k].canEdit = false
          if (!newPerEdition[k].canDelete) newPerEdition[k] = undefined as any
        }
      }
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
    const users = await $fetch<any[]>('/api/users/search', { query: { q: query } })
    userItems.value = (users as any[]).map((u: any) => ({
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

function onSearchUpdate(v: string) {
  searchTerm.value = v
}

function newPerEditionKeysReset() {
  for (const key in newPerEdition) {
    newPerEdition[Number(key)] = undefined as any
  }
}

function toggleNewPerEdition(
  editionId: number,
  field: 'canEdit' | 'canDelete',
  val: boolean | string
) {
  const boolVal = typeof val === 'string' ? val === 'true' || val === '1' : !!val
  if (!newPerEdition[editionId]) newPerEdition[editionId] = { canEdit: false, canDelete: false }
  newPerEdition[editionId][field] = boolVal
  if (!newPerEdition[editionId].canEdit && !newPerEdition[editionId].canDelete) {
    newPerEdition[editionId] = undefined as any
  }
}
const resetNewPerEdition = () => newPerEditionKeysReset()

function toggleEdit(c: CollaboratorItem) {
  // Si on change d'éditeur avec modifications non sauvegardées -> confirmation
  if (editingId.value && editingId.value !== c.id) {
    if (hasUnsavedChanges(editingId.value) && !confirmUnsaved()) {
      return
    }
  }
  if (editingId.value === c.id) {
    // Fermeture simple (vérifier modifications courantes)
    if (hasUnsavedChanges(c.id) && !confirmUnsaved()) return
    editingId.value = null
    return
  }
  if (!editForms[c.id]) {
    const form: EditForm = {
      title: c.title || null,
      rights: {
        editConvention: !!c.rights?.editConvention,
        deleteConvention: !!c.rights?.deleteConvention,
        manageCollaborators: !!c.rights?.manageCollaborators,
        addEdition: !!c.rights?.addEdition,
        editAllEditions: !!c.rights?.editAllEditions,
        deleteAllEditions: !!c.rights?.deleteAllEditions,
      },
      perEdition: {},
    }
    if (c.perEdition?.length) {
      c.perEdition.forEach((p) => {
        if (!form.perEdition[p.editionId]) {
          form.perEdition[p.editionId] = { canEdit: !!p.canEdit, canDelete: !!p.canDelete }
        }
      })
    }
    editForms[c.id] = form
  }
  editingId.value = c.id
}

function cancelEdit() {
  if (editingId.value && hasUnsavedChanges(editingId.value) && !confirmUnsaved()) return
  editingId.value = null
}

function toggleEditPerEdition(
  collabId: number,
  editionId: number,
  field: 'canEdit' | 'canDelete',
  val: boolean
) {
  const form = editForms[collabId]
  if (!form) return
  if (!form.perEdition[editionId]) form.perEdition[editionId] = { canEdit: false, canDelete: false }
  form.perEdition[editionId][field] = val
  if (!form.perEdition[editionId].canEdit && !form.perEdition[editionId].canDelete) {
    form.perEdition[editionId] = undefined as any
  }
}

async function saveEdit(c: CollaboratorItem) {
  if (!props.convention || !editForms[c.id]) return
  try {
    updateLoading.value = true
    const form = editForms[c.id]
    if (!form) return
    // Nettoyage si editAllEditions
    if (form.rights.editAllEditions) {
      for (const k in form.perEdition) {
        if (form.perEdition[k]) {
          form.perEdition[k].canEdit = false
          if (!form.perEdition[k].canDelete) form.perEdition[k] = undefined as any
        }
      }
    }
    await $fetch(`/api/conventions/${props.convention.id}/collaborators/${c.id}/rights`, {
      method: 'PATCH',
      body: {
        title: form?.title || undefined,
        rights: { ...form?.rights },
        perEdition: Object.entries(form?.perEdition || {})
          .filter(([, v]) => !!v && ((v as any).canEdit || (v as any).canDelete))
          .map(([editionId, v]: any) => ({
            editionId: Number(editionId),
            canEdit: v.canEdit,
            canDelete: v.canDelete,
          })),
      },
    })
    toast.add({
      title: t('components.collaborators_modal.edit_rights'),
      description: t('components.collaborators_modal.updating_rights_success'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    markSaved(c.id)
    editingId.value = null
    await fetchCollaborators()
  } catch (error: any) {
    toast.add({
      title: t('components.collaborators_modal.edit_rights'),
      description:
        error?.data?.message ||
        error?.message ||
        t('components.collaborators_modal.updating_rights_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    updateLoading.value = false
  }
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
        perEdition: Object.entries(newPerEdition)
          .filter(([, v]) => !!v && ((v as any).canEdit || (v as any).canDelete))
          .map(([editionId, v]: any) => ({
            editionId: Number(editionId),
            canEdit: v.canEdit,
            canDelete: v.canDelete,
          })),
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
    newPerEditionKeysReset()
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

// ===== Gestion modifications non sauvegardées =====
function formSnapshot(f: EditForm) {
  return JSON.stringify({
    title: f.title,
    rights: f.rights,
    perEdition: Object.fromEntries(
      Object.entries(f.perEdition).filter(([_, v]: any) => v && (v.canEdit || v.canDelete))
    ),
  })
}
const initialSnapshots = reactive<Record<number, string>>({})

function ensureSnapshot(id: number) {
  if (!initialSnapshots[id] && editForms[id]) initialSnapshots[id] = formSnapshot(editForms[id])
}

function hasUnsavedChanges(id: number): boolean {
  const form = editForms[id]
  if (!form) return false
  ensureSnapshot(id)
  return initialSnapshots[id] !== formSnapshot(form)
}

function markSaved(id: number) {
  if (editForms[id]) initialSnapshots[id] = formSnapshot(editForms[id])
}

function confirmUnsaved(): boolean {
  return confirm(
    `${t('components.collaborators_modal.unsaved_warning_title')}\n${t('components.collaborators_modal.unsaved_warning_message')}`
  )
}

// Marquer sauvegarde après enregistrement
watch(editingId, (id) => {
  if (id && editForms[id]) ensureSnapshot(id)
})

// Intercepter fermeture du modal
watch(
  () => isOpen.value,
  (open, prev) => {
    if (!open && prev && editingId.value && hasUnsavedChanges(editingId.value)) {
      if (!confirmUnsaved()) {
        // Réouvrir
        isOpen.value = true
      } else {
        editingId.value = null
      }
    }
  }
)

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
