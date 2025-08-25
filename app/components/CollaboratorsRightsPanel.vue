<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h5 class="text-sm font-medium text-gray-900 dark:text-white">
        {{ $t('components.collaborators_rights_panel.title') }}
      </h5>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-heroicons-arrow-path"
        :loading="loading"
        @click="refresh"
        >{{ $t('common.refresh') }}</UButton
      >
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ $t('common.loading') }}</div>
    <div v-else-if="!collaborators.length" class="text-sm italic text-gray-500">
      {{ $t('components.collaborators_rights_panel.no_collaborators') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="c in collaborators"
        :key="c.id"
        class="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white/60 dark:bg-gray-900/40"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium flex items-center gap-2">
              <span class="truncate max-w-[160px]" :title="c.user.pseudo">{{ c.user.pseudo }}</span>
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
              class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]"
            >
              {{ c.title }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              :icon="
                expandedId === c.id
                  ? 'i-heroicons-chevron-up'
                  : 'i-heroicons-adjustments-horizontal'
              "
              :disabled="deletingId === c.id"
              @click="toggle(c.id)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-heroicons-trash"
              :loading="deletingId === c.id"
              :disabled="deletingId === c.id || savingId === c.id"
              @click="removeCollaborator(c)"
            />
          </div>
        </div>

        <div
          v-if="expandedId === c.id"
          class="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3"
        >
          <!-- Rights form extracted into reusable component -->
          <form class="space-y-4" @submit.prevent="save(c)">
            <CollaboratorRightsFields
              v-if="draft[c.id]"
              v-model="draft[c.id]"
              :editions="editions"
              size="xs"
            />
            <div class="flex justify-end gap-2">
              <UButton size="xs" color="neutral" variant="ghost" @click="cancel(c.id)">{{
                $t('common.cancel')
              }}</UButton>
              <UButton
                size="xs"
                color="primary"
                icon="i-heroicons-check"
                :loading="savingId === c.id"
                type="submit"
                >{{ $t('common.save') }}</UButton
              >
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  <!-- History section -->
  <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
    <div class="flex items-center justify-between mb-2">
      <h5 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-heroicons-clock" />
        {{ $t('components.collaborators_rights_panel.history_title') }}
      </h5>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :loading="historyLoading"
        icon="i-heroicons-arrow-path"
        @click="fetchHistory"
        >{{ $t('components.collaborators_rights_panel.refresh_history') }}</UButton
      >
    </div>
    <div v-if="historyLoading" class="text-xs text-gray-500">{{ $t('common.loading') }}</div>
    <div v-else-if="!history.length && historyLoaded" class="text-xs italic text-gray-500">
      {{ $t('components.collaborators_rights_panel.no_history') }}
    </div>
    <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
      <div
        v-for="h in history"
        :key="h.id"
        class="p-2 bg-white/70 dark:bg-gray-900/40 rounded border border-gray-200 dark:border-gray-700"
      >
        <div class="flex justify-between items-center">
          <span
            class="text-[11px] uppercase tracking-wide font-semibold text-indigo-600 dark:text-indigo-400"
            >{{ formatChangeType(h.changeType) }}</span
          >
          <span class="text-[10px] text-gray-400">{{ timeAgo(h.createdAt) }}</span>
        </div>
        <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-2">
          <span v-if="h.targetUser">{{ $t('components.collaborators_rights_panel.target_user', { user: h.targetUser.pseudo }) }}</span>
          <span v-if="h.actor" class="opacity-70">{{ $t('components.collaborators_rights_panel.by_user', { user: h.actor.pseudo }) }}</span>
        </div>
      </div>
    </div>
    <div v-if="!historyLoaded && !historyLoading" class="text-xs text-gray-500">
      <UButton size="xs" color="primary" variant="soft" @click="fetchHistory">{{
        $t('components.collaborators_rights_panel.load_history')
      }}</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  conventionId: number | null
}
const props = defineProps<Props>()

interface EditionLite {
  id: number
  name: string | null
}
interface PerEditionRight {
  editionId: number
  canEdit?: boolean
  canDelete?: boolean
}
interface CollaboratorItem {
  id: number
  user: { id: number; pseudo: string }
  title?: string | null
  rights: Record<string, boolean | undefined>
  perEdition: PerEditionRight[]
}
interface DraftEntry {
  title: string | null
  rights: Record<string, boolean>
  perEdition: PerEditionRight[]
}

const { t } = useI18n()
const toast = useToast()

const collaborators = ref<CollaboratorItem[]>([])
const editions = ref<EditionLite[]>([])
const loading = ref(false)
const savingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const draft = reactive<Record<number, DraftEntry>>({})
// History state
interface HistoryItem {
  id: number
  changeType: string
  createdAt: string
  actor?: { id: number; pseudo: string }
  targetUser?: { id: number; pseudo: string } | null
  before?: any
  after?: any
}
const history = ref<HistoryItem[]>([])
const historyLoading = ref(false)
const historyLoaded = ref(false)

function formatChangeType(type: string) {
  const map: Record<string, string> = {
    RIGHTS_UPDATED: t('permissions.history.RIGHTS_UPDATED'),
    PER_EDITIONS_UPDATED: t('permissions.history.PER_EDITIONS_UPDATED'),
    ARCHIVED: t('permissions.history.ARCHIVED'),
    UNARCHIVED: t('permissions.history.UNARCHIVED'),
    CREATED: t('permissions.history.CREATED') || 'Créé',
    REMOVED: t('permissions.history.REMOVED') || 'Retiré',
  }
  return map[type] || type
}
function timeAgo(dateStr: string) {
  const d = new Date(dateStr).getTime()
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('common.time_just_now')
  if (m < 60) return t('common.time_minutes_ago', { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('common.time_hours_ago', { count: h })
  const days = Math.floor(h / 24)
  return t('common.time_days_ago', { count: days })
}
async function fetchHistory() {
  if (!props.conventionId) return
  historyLoading.value = true
  try {
    history.value = await $fetch(`/api/conventions/${props.conventionId}/collaborators/history`)
    historyLoaded.value = true
  } catch (e) {
    console.error(e)
  } finally {
    historyLoading.value = false
  }
}

// Minimal list of global permissions (edition-level later)
const permissionList = [
  { key: 'editConvention', label: 'permissions.editConvention' },
  { key: 'deleteConvention', label: 'permissions.deleteConvention' },
  { key: 'manageCollaborators', label: 'permissions.manageCollaborators' },
  { key: 'addEdition', label: 'permissions.addEdition' },
  { key: 'editAllEditions', label: 'permissions.editAllEditions' },
  { key: 'deleteAllEditions', label: 'permissions.deleteAllEditions' },
]

function ensureDraft(c: CollaboratorItem) {
  if (!draft[c.id]) {
    draft[c.id] = {
      title: c.title || null,
      rights: Object.fromEntries(permissionList.map((p) => [p.key, !!c.rights[p.key]])),
      perEdition: JSON.parse(JSON.stringify(c.perEdition || [])),
    }
  }
}
function toggle(id: number) {
  if (expandedId.value === id) {
    expandedId.value = null
    return
  }
  const c = collaborators.value.find((x) => x.id === id)
  if (!c) return
  ensureDraft(c)
  expandedId.value = id
}
function cancel(id: number) {
  draft[id] = undefined as any
  if (expandedId.value === id) expandedId.value = null
}

async function refresh() {
  if (!props.conventionId) return
  loading.value = true
  try {
    const [collabs, eds] = await Promise.all([
      $fetch<CollaboratorItem[]>(`/api/conventions/${props.conventionId}/collaborators`),
      $fetch<Array<{ id: number; name: string | null }>>(
        `/api/conventions/${props.conventionId}/editions`
      ),
    ])
    collaborators.value = collabs
    editions.value = eds.map((e) => ({ id: e.id, name: e.name }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function save(c: CollaboratorItem) {
  if (!props.conventionId) return
  const d = draft[c.id]
  if (!d) return
  savingId.value = c.id
  try {
    await $fetch(`/api/conventions/${props.conventionId}/collaborators/${c.id}`, {
      method: 'PATCH' as any,
      body: { title: d.title, rights: d.rights, perEdition: d.perEdition },
    })
    toast.add({
      title: t('components.collaborators_rights_panel.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    await refresh()
    expandedId.value = null
    draft[c.id] = undefined as any
  } catch (e: any) {
    toast.add({
      title: t('errors.update_error'),
      description: e?.data?.message || e?.message,
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingId.value = null
  }
}

async function removeCollaborator(c: CollaboratorItem) {
  if (!props.conventionId) return
  // Confirmation simple (i18n si clé existante sinon fallback)
  const confirmMsg =
    t?.('components.collaborators_rights_panel.delete_confirm') || 'Supprimer ce collaborateur ?'
  if (!window.confirm(confirmMsg)) return
  deletingId.value = c.id
  try {
    const res: any = await $fetch(`/api/conventions/${props.conventionId}/collaborators/${c.id}`, {
      method: 'DELETE' as any,
    })
    if (!res?.success) {
      toast.add({
        title: t('errors.delete_error'),
        description: res?.message || 'Erreur',
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    } else {
      toast.add({
        title: t('common.deleted') || 'Supprimé',
        description: res?.message,
        color: 'success',
        icon: 'i-heroicons-trash',
      })
    }
    await refresh()
  } catch (e: any) {
    toast.add({
      title: t('errors.delete_error'),
      description: e?.data?.message || e?.message,
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    deletingId.value = null
  }
}

watch(
  () => props.conventionId,
  (v) => {
    if (v) refresh()
  },
  { immediate: true }
)

// Expose pour que le parent puisse forcer un refresh après ajout/suppression externe
defineExpose({ refresh })
</script>
