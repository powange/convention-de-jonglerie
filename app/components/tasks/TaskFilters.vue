<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="flex flex-col lg:flex-row lg:items-center gap-2">
      <UInput
        v-model="search"
        :placeholder="$t('gestion.tasks.filters.search_placeholder')"
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="flex-1 min-w-0 lg:max-w-xs"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="search" #trailing>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="search = ''"
          />
        </template>
      </UInput>

      <USelectMenu
        v-model="selectedStatuses"
        :items="statusItems"
        multiple
        :placeholder="$t('gestion.tasks.filters.status_placeholder')"
        size="sm"
        class="min-w-40"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length">
            {{ $t('gestion.tasks.filters.status_placeholder') }}
          </span>
          <span v-else-if="selected.length === 1">
            {{ selected[0].label }}
          </span>
          <span v-else>
            {{ $t('gestion.tasks.filters.statuses_count', { count: selected.length }) }}
          </span>
        </template>
      </USelectMenu>

      <USelectMenu
        v-if="!hideAssignees"
        v-model="selectedAssignees"
        :items="assigneeItems"
        multiple
        searchable
        :searchable-placeholder="$t('common.search')"
        :placeholder="$t('gestion.tasks.filters.assignee_placeholder')"
        size="sm"
        class="min-w-44"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length">
            {{ $t('gestion.tasks.filters.assignee_placeholder') }}
          </span>
          <span v-else-if="selected.length === 1">
            {{ selected[0].label }}
          </span>
          <span v-else>
            {{ $t('gestion.tasks.filters.assignees_count', { count: selected.length }) }}
          </span>
        </template>
      </USelectMenu>

      <USelect
        v-if="hasDeadlines"
        v-model="dueFilter"
        :items="dueItems"
        size="sm"
        class="min-w-40"
      />

      <div class="flex-1" />

      <div class="flex items-center gap-2 shrink-0">
        <UBadge v-if="activeCount" color="primary" variant="soft" size="sm">
          {{ $t('gestion.tasks.filters.active_count', { count: activeCount }) }}
        </UBadge>
        <UButton
          v-if="activeCount"
          icon="i-heroicons-x-mark"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="reset"
        >
          {{ $t('common.reset') }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

interface AssignableUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
}

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
type DueFilter = 'all' | 'overdue' | 'today' | 'next7' | 'next30' | 'none'

export interface TaskFiltersValue {
  q: string
  assigneeIds: number[]
  statuses: TaskStatus[]
  due: DueFilter
}

const props = defineProps<{
  modelValue: TaskFiltersValue
  assignableUsers: AssignableUser[]
  /** Assignés "legacy" (présents sur des tâches mais plus dans la liste assignables) */
  legacyAssignees?: AssignableUser[]
  /** Au moins une tâche du groupe a une échéance — sinon le filtre est masqué */
  hasDeadlines?: boolean
  /** Masque le filtre assignés (utile pour la vue « Mes tâches ») */
  hideAssignees?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: TaskFiltersValue]
}>()

const { t } = useI18n()

const search = ref(props.modelValue.q)
const searchDebounced = refDebounced(search, 250)

interface StatusItem {
  label: string
  value: TaskStatus
}
const statusItems = computed<StatusItem[]>(() =>
  (['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as TaskStatus[]).map((s) => ({
    label: t(`gestion.tasks.status.${s}`),
    value: s,
  }))
)
const selectedStatuses = ref<StatusItem[]>(
  statusItems.value.filter((it) => props.modelValue.statuses.includes(it.value))
)

interface AssigneeItem {
  label: string
  value: number
  user: AssignableUser
  avatar: { src: string; alt: string; loading: 'lazy' }
}
const { getUserAvatar } = useAvatar()
function buildAssigneeItem(u: AssignableUser): AssigneeItem {
  return {
    label: u.pseudo,
    value: u.id,
    user: u,
    avatar: { src: getUserAvatar(u, 32), alt: u.pseudo, loading: 'lazy' },
  }
}
const assigneeItems = computed<AssigneeItem[]>(() => {
  const seen = new Set<number>()
  const items: AssigneeItem[] = []
  for (const u of props.assignableUsers) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    items.push(buildAssigneeItem(u))
  }
  for (const u of props.legacyAssignees || []) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    items.push(buildAssigneeItem(u))
  }
  return items.sort((a, b) => a.label.localeCompare(b.label))
})
const selectedAssignees = ref<AssigneeItem[]>(
  assigneeItems.value.filter((it) => props.modelValue.assigneeIds.includes(it.value))
)

const dueItems = computed(() => [
  { label: t('gestion.tasks.filters.due.all'), value: 'all' as DueFilter },
  { label: t('gestion.tasks.filters.due.overdue'), value: 'overdue' as DueFilter },
  { label: t('gestion.tasks.filters.due.today'), value: 'today' as DueFilter },
  { label: t('gestion.tasks.filters.due.next7'), value: 'next7' as DueFilter },
  { label: t('gestion.tasks.filters.due.next30'), value: 'next30' as DueFilter },
  { label: t('gestion.tasks.filters.due.none'), value: 'none' as DueFilter },
])
const dueFilter = ref<DueFilter>(props.modelValue.due)

const activeCount = computed(() => {
  let n = 0
  if (search.value.trim()) n++
  if (selectedStatuses.value.length) n++
  if (selectedAssignees.value.length) n++
  if (dueFilter.value !== 'all') n++
  return n
})

function reset() {
  search.value = ''
  selectedStatuses.value = []
  selectedAssignees.value = []
  dueFilter.value = 'all'
}

// Synchronise la valeur émise dès qu'un filtre change (recherche debounced).
watch(
  [searchDebounced, selectedStatuses, selectedAssignees, dueFilter],
  () => {
    emit('update:modelValue', {
      q: searchDebounced.value.trim(),
      statuses: selectedStatuses.value.map((it) => it.value),
      assigneeIds: selectedAssignees.value.map((it) => it.value),
      due: dueFilter.value,
    })
  },
  { deep: true }
)

// Si le parent change la valeur (ex: lecture URL au mount), resynchronise les refs locales.
watch(
  () => props.modelValue,
  (next) => {
    if (next.q !== search.value) search.value = next.q
    const nextStatusSet = new Set(next.statuses)
    if (
      nextStatusSet.size !== selectedStatuses.value.length ||
      selectedStatuses.value.some((it) => !nextStatusSet.has(it.value))
    ) {
      selectedStatuses.value = statusItems.value.filter((it) => nextStatusSet.has(it.value))
    }
    const nextAssigneeSet = new Set(next.assigneeIds)
    if (
      nextAssigneeSet.size !== selectedAssignees.value.length ||
      selectedAssignees.value.some((it) => !nextAssigneeSet.has(it.value))
    ) {
      selectedAssignees.value = assigneeItems.value.filter((it) => nextAssigneeSet.has(it.value))
    }
    if (next.due !== dueFilter.value) dueFilter.value = next.due
  }
)
</script>
