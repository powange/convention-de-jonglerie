<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="flex flex-col lg:flex-row lg:items-center gap-2">
      <UInput
        v-model="search"
        :placeholder="$t('tasks.filters.search_placeholder')"
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
        :placeholder="$t('tasks.filters.status_placeholder')"
        size="sm"
        class="min-w-40"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length">
            {{ $t('tasks.filters.status_placeholder') }}
          </span>
          <span v-else-if="selected.length === 1">
            {{ selected[0].label }}
          </span>
          <span v-else>
            {{ $t('tasks.filters.statuses_count', { count: selected.length }) }}
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
        :placeholder="$t('tasks.filters.assignee_placeholder')"
        size="sm"
        class="min-w-44"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length">
            {{ $t('tasks.filters.assignee_placeholder') }}
          </span>
          <span v-else-if="selected.length === 1">
            {{ selected[0].label }}
          </span>
          <span v-else>
            {{ $t('tasks.filters.assignees_count', { count: selected.length }) }}
          </span>
        </template>
      </USelectMenu>

      <USelectMenu
        v-if="tagItems.length"
        v-model="selectedTags"
        :items="tagItems"
        multiple
        :placeholder="$t('tasks.filters.tag_placeholder')"
        size="sm"
        class="min-w-40"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length">
            {{ $t('tasks.filters.tag_placeholder') }}
          </span>
          <span v-else-if="selected.length === 1">
            {{ selected[0].label }}
          </span>
          <span v-else>
            {{ $t('tasks.filters.tags_count', { count: selected.length }) }}
          </span>
        </template>
        <template #item-leading="{ item }">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: item.color }" />
        </template>
      </USelectMenu>

      <USelect
        v-if="hasDeadlines"
        v-model="dueFilter"
        :items="dueItems"
        size="sm"
        class="min-w-40"
      />

      <!-- Masqué quand aucune tâche n'a d'échéance, comme le filtre : trier par une date que
           personne n'a renseignée n'aurait aucun effet visible. -->
      <USelect
        v-if="hasDeadlines"
        v-model="sort"
        :items="sortItems"
        size="sm"
        class="min-w-44"
        icon="i-heroicons-arrows-up-down"
      />

      <div class="flex-1" />

      <div class="flex items-center gap-2 shrink-0">
        <UBadge v-if="activeCount" color="primary" variant="soft" size="sm">
          {{ $t('tasks.filters.active_count', { count: activeCount }) }}
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

interface TagOption {
  id: number
  name: string
  color: string
}

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
type DueFilter = 'all' | 'overdue' | 'today' | 'next7' | 'next30' | 'none'

/**
 * `manual` conserve l'ordre construit au glisser-déposer : c'est une intention, et elle reste
 * le défaut. Les deux autres classent par échéance, les tâches sans date allant toujours à la
 * fin — les intercaler laisserait croire à une urgence qu'elles n'ont pas.
 */
export type TaskSort = 'manual' | 'deadline_asc' | 'deadline_desc'

export interface TaskFiltersValue {
  q: string
  assigneeIds: number[]
  statuses: TaskStatus[]
  due: DueFilter
  tagIds: number[]
  sort: TaskSort
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
  /** Tags disponibles sur l'édition — si vide, le filtre tag est masqué */
  availableTags?: TagOption[]
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
    label: t(`tasks.status.${s}`),
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

interface TagSelectItem {
  label: string
  value: number
  color: string
}
const tagItems = computed<TagSelectItem[]>(() =>
  (props.availableTags || []).map((tg) => ({ label: tg.name, value: tg.id, color: tg.color }))
)
const selectedTags = ref<TagSelectItem[]>(
  tagItems.value.filter((it) => props.modelValue.tagIds.includes(it.value))
)

const dueItems = computed(() => [
  { label: t('tasks.filters.due.all'), value: 'all' as DueFilter },
  { label: t('tasks.filters.due.overdue'), value: 'overdue' as DueFilter },
  { label: t('tasks.filters.due.today'), value: 'today' as DueFilter },
  { label: t('tasks.filters.due.next7'), value: 'next7' as DueFilter },
  { label: t('tasks.filters.due.next30'), value: 'next30' as DueFilter },
  { label: t('tasks.filters.due.none'), value: 'none' as DueFilter },
])
const dueFilter = ref<DueFilter>(props.modelValue.due)

const sortItems = computed(() => [
  { label: t('tasks.filters.sort.manual'), value: 'manual' as TaskSort },
  { label: t('tasks.filters.sort.deadline_asc'), value: 'deadline_asc' as TaskSort },
  { label: t('tasks.filters.sort.deadline_desc'), value: 'deadline_desc' as TaskSort },
])
const sort = ref<TaskSort>(props.modelValue.sort)

const activeCount = computed(() => {
  let n = 0
  if (search.value.trim()) n++
  if (selectedStatuses.value.length) n++
  if (selectedAssignees.value.length) n++
  if (selectedTags.value.length) n++
  if (dueFilter.value !== 'all') n++
  // Le tri compte lui aussi : il ne masque rien, mais il change l'ordre affiché, et le bouton
  // « réinitialiser » doit apparaître pour pouvoir revenir à l'ordre manuel.
  if (sort.value !== 'manual') n++
  return n
})

function reset() {
  search.value = ''
  selectedStatuses.value = []
  selectedAssignees.value = []
  selectedTags.value = []
  dueFilter.value = 'all'
  sort.value = 'manual'
}

// Synchronise la valeur émise dès qu'un filtre change (recherche debounced).
watch(
  [searchDebounced, selectedStatuses, selectedAssignees, selectedTags, dueFilter, sort],
  () => {
    emit('update:modelValue', {
      q: searchDebounced.value.trim(),
      statuses: selectedStatuses.value.map((it) => it.value),
      assigneeIds: selectedAssignees.value.map((it) => it.value),
      tagIds: selectedTags.value.map((it) => it.value),
      due: dueFilter.value,
      sort: sort.value,
    })
  },
  { deep: true }
)

// Si le parent change la valeur (ex: lecture URL au mount), resynchronise les refs locales.
watch(
  () => props.modelValue,
  (next) => {
    if (next.q !== search.value) search.value = next.q
    if (next.sort !== sort.value) sort.value = next.sort
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
    const nextTagSet = new Set(next.tagIds)
    if (
      nextTagSet.size !== selectedTags.value.length ||
      selectedTags.value.some((it) => !nextTagSet.has(it.value))
    ) {
      selectedTags.value = tagItems.value.filter((it) => nextTagSet.has(it.value))
    }
    if (next.due !== dueFilter.value) dueFilter.value = next.due
  }
)
</script>
