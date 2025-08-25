<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('components.collaborators_modal.title')"
    :description="$t('components.collaborators_modal.description')"
    close-icon="i-heroicons-x-mark-20-solid"
  >
    <template #body>
      <div class="space-y-8">
        <section v-if="props.convention">
          <CollaboratorsRightsPanel
            ref="rightsPanel"
            :convention-id="props.convention?.id || null"
          />
        </section>
        <section v-if="props.convention" class="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div
            class="flex items-center justify-between mb-2 cursor-pointer select-none group"
            role="button"
            :aria-expanded="showAddSection ? 'true' : 'false'"
            tabindex="0"
            @click="toggleAddSection"
            @keydown.enter.prevent="toggleAddSection"
            @keydown.space.prevent="toggleAddSection"
          >
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('components.collaborators_modal.add_collaborator') }}
            </h4>
            <UIcon
              :name="showAddSection ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="h-5 w-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200 transition-colors"
            />
          </div>
          <div v-if="showAddSection" class="space-y-4">
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

            <!-- Formulaire factorisé (binding explicite pour conserver la réactivité interne) -->
            <CollaboratorRightsFields
              :model-value="creationDraft"
              :editions="editions"
              size="xs"
              @update:model-value="updateCreationDraft"
            />

            <div class="flex justify-end pt-1">
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
        </section>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
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
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'collaborator-added' | 'collaborator-removed'): void
}>()

const { normalizeImageUrl } = useImageUrl()
const toast = useToast()
const { t } = useI18n()

// Référence au panneau de droits pour rafraîchir la liste après ajout
const rightsPanel = ref<any>(null)

const selectedUser = ref<UserItem | undefined>(undefined)
const searchTerm = ref('')
// Champ legacy (sélection d'un rôle) supprimé: on gardera bientôt un formulaire de droits granulaires direct.
// Draft de création unifié pour composant factorisé
const creationDraft = reactive<{
  title: string | null
  rights: Record<string, boolean>
  perEdition: Array<{ editionId: number; canEdit?: boolean; canDelete?: boolean }>
}>({
  title: null,
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageCollaborators: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  perEdition: [],
})
const loading = ref(false)
const searchLoading = ref(false)
const userItems = ref<UserItem[]>([])
const collaborators = ref<CollaboratorItem[]>([])
const collaboratorsLoading = ref(false)
const editions = ref<Array<{ id: number; name: string | null }>>([])
// État repli/affichage de la section d'ajout
const showAddSection = ref(false)

function toggleAddSection() {
  showAddSection.value = !showAddSection.value
}

function updateCreationDraft(v: {
  title: string | null
  rights: Record<string, boolean>
  perEdition: any[]
}) {
  creationDraft.title = v.title
  // Mettre à jour seulement les clés existantes pour éviter d'en introduire d'inconnues
  for (const k in creationDraft.rights) {
    if (Object.prototype.hasOwnProperty.call(v.rights, k)) {
      creationDraft.rights[k] = !!v.rights[k]
    }
  }
  // Remplacer le tableau perEdition (nouvelle référence acceptable)
  creationDraft.perEdition = v.perEdition.map((p) => ({ ...p }))
}

// (Ancien helper d'édition supprimé)

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
    collaborators.value = await $fetch<CollaboratorItem[]>(
      `/api/conventions/${props.convention.id}/collaborators`
    )
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
      Object.keys(creationDraft.rights).forEach((k) => (creationDraft.rights[k] = false))
      creationDraft.perEdition = []
      creationDraft.title = null
      userItems.value = []
  showAddSection.value = false
    }
  }
)

// Si "éditer toutes les éditions" est activé, on supprime les flags canEdit par édition (inutile & éviter confusion)
watch(
  () => creationDraft.rights.editAllEditions,
  (val) => {
    if (val) {
      creationDraft.perEdition = creationDraft.perEdition.filter((p) => p.canDelete)
      creationDraft.perEdition.forEach((p) => {
        if (p.canEdit) p.canEdit = false
      })
      creationDraft.perEdition = creationDraft.perEdition.filter((p) => p.canDelete)
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

// Add collaborator
async function handleAddCollaborator() {
  if (!props.convention || !selectedUser.value) return
  try {
    loading.value = true
    await $fetch(`/api/conventions/${props.convention.id}/collaborators`, {
      method: 'POST',
      body: {
        userId: selectedUser.value.value,
        rights: { ...creationDraft.rights },
        title: creationDraft.title || undefined,
        perEdition: creationDraft.perEdition,
      },
    })
    toast.add({
      title: t('messages.collaborator_added'),
      description: t('messages.collaborator_added_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('collaborator-added')
    // Un seul rafraîchissement (panel) pour éviter double requête
    rightsPanel.value?.refresh?.()
    // reset form
    selectedUser.value = undefined
    searchTerm.value = ''
    Object.keys(creationDraft.rights).forEach((k) => (creationDraft.rights[k] = false))
    creationDraft.perEdition = []
    creationDraft.title = null
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

// (Fin)
</script>
