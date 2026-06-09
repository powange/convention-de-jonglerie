<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <UButton
        :to="`/editions/${editionId}/gestion/tasks`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('edition.tasks') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!group"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.task.group_not_found') }}
      </p>
      <UButton
        :to="`/editions/${editionId}/gestion/tasks`"
        icon="i-heroicons-arrow-left"
        color="primary"
        size="sm"
      >
        {{ $t('edition.tasks') }}
      </UButton>
    </div>

    <div v-else class="space-y-4">
      <!-- En-tête du groupe -->
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon
              name="i-heroicons-clipboard-document-check"
              class="text-rose-500 size-6 mt-1 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-semibold">{{ group.name }}</h1>
              <p v-if="group.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ group.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UTabs
              v-model="viewMode"
              :items="viewItems"
              size="sm"
              color="primary"
              variant="pill"
              :ui="{ list: 'w-auto' }"
            />
            <UButton icon="i-heroicons-plus" size="sm" color="primary" @click="openTaskModal(null)">
              {{ $t('gestion.task.new_task') }}
            </UButton>
            <UDropdownMenu :items="groupActions">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="sm"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>

      <!-- Filtres et recherche -->
      <TasksTaskFilters
        v-if="group.tasks.length"
        v-model="filters"
        :assignable-users="assignableUsers"
        :legacy-assignees="legacyAssignees"
        :has-deadlines="hasDeadlines"
        :available-tags="availableTags"
      />

      <!-- Vue Liste -->
      <div v-if="viewMode === 'list'">
        <div
          v-if="!group.tasks.length"
          class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
        >
          <UIcon name="i-heroicons-inbox" class="size-10 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            {{ $t('gestion.task.empty_group') }}
          </p>
          <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openTaskModal(null)">
            {{ $t('gestion.task.new_task') }}
          </UButton>
        </div>
        <div
          v-else-if="!filteredTasks.length"
          class="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
        >
          <UIcon name="i-heroicons-funnel" class="size-8 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {{ $t('tasks.filters.no_match') }}
          </p>
        </div>
        <UCard v-else>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="task in filteredTasks"
              :key="task.id"
              class="py-2 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 px-2 -mx-2 rounded cursor-pointer"
              @click="openTaskModal(task)"
            >
              <UBadge :color="statusColor(task.status)" variant="soft" size="md" class="mt-0.5">
                {{ $t(`tasks.status.${task.status}`) }}
              </UBadge>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">{{ task.title }}</div>
                <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                  <div
                    v-if="task.deadline"
                    class="text-xs flex items-center gap-1"
                    :class="deadlineClass(task.deadline, task.status)"
                  >
                    <UIcon name="i-heroicons-calendar" class="size-3" />
                    {{ formatDeadline(task.deadline) }}
                  </div>
                  <div
                    v-if="task.checklistItems.length"
                    class="text-xs flex items-center gap-1 text-gray-500"
                  >
                    <UIcon name="i-heroicons-check-circle" class="size-3" />
                    {{ checklistDone(task) }} / {{ task.checklistItems.length }}
                  </div>
                  <div v-if="task.tagAssignments.length" class="flex flex-wrap gap-1">
                    <TasksTaskTagBadge
                      v-for="a in task.tagAssignments"
                      :key="a.tag.id"
                      :tag="a.tag"
                    />
                  </div>
                </div>
              </div>
              <div v-if="task.assignments.length" class="flex -space-x-1 shrink-0">
                <UiUserAvatar
                  v-for="a in task.assignments.slice(0, 3)"
                  :key="a.user.id"
                  :user="a.user"
                  size="md"
                  class="ring-2 ring-white dark:ring-gray-900"
                />
                <UBadge
                  v-if="task.assignments.length > 3"
                  color="neutral"
                  variant="soft"
                  size="md"
                  class="ring-2 ring-white dark:ring-gray-900"
                >
                  +{{ task.assignments.length - 3 }}
                </UBadge>
              </div>
            </li>
          </ul>
        </UCard>
      </div>

      <!-- Vue Kanban -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          v-for="status in kanbanStatuses"
          :key="status"
          class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 min-h-50 transition-colors"
          :class="
            dragOverStatus === status && draggedFromStatus !== status
              ? 'ring-2 ring-primary-500'
              : ''
          "
          @dragover.prevent="onColumnDragOver(status)"
          @dragleave="onColumnDragLeave(status, $event)"
          @drop="onColumnDrop(status)"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <UBadge :color="statusColor(status)" variant="soft" size="sm">
                {{ $t(`tasks.status.${status}`) }}
              </UBadge>
              <span class="text-xs text-gray-500">{{ tasksByStatus(status).length }}</span>
            </div>
          </div>
          <div class="space-y-2 min-h-10">
            <UCard
              v-for="task in tasksByStatus(status)"
              :key="task.id"
              draggable="true"
              :class="[
                'cursor-grab active:cursor-grabbing hover:shadow-md transition-all',
                draggedTaskId === task.id ? 'opacity-50' : '',
                dragOverTaskId === task.id && dragOverPosition === 'before'
                  ? 'border-t-2 border-t-primary-500'
                  : '',
                dragOverTaskId === task.id && dragOverPosition === 'after'
                  ? 'border-b-2 border-b-primary-500'
                  : '',
              ]"
              :ui="{ body: 'p-3' }"
              @click="onTaskClick(task)"
              @dragstart="onTaskDragStart(task, $event)"
              @dragend="onTaskDragEnd"
              @dragover.prevent="onCardDragOver(task, $event)"
              @dragleave="onCardDragLeave(task)"
              @drop.stop="onCardDrop(task)"
            >
              <div class="font-medium text-sm mb-2">{{ task.title }}</div>
              <div v-if="task.tagAssignments.length" class="flex flex-wrap gap-1 mb-2">
                <TasksTaskTagBadge v-for="a in task.tagAssignments" :key="a.tag.id" :tag="a.tag" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    v-if="task.deadline"
                    class="text-xs flex items-center gap-1"
                    :class="deadlineClass(task.deadline, task.status)"
                  >
                    <UIcon name="i-heroicons-calendar" class="size-3" />
                    {{ formatDeadline(task.deadline) }}
                  </div>
                  <div
                    v-if="task.checklistItems.length"
                    class="text-xs flex items-center gap-1 text-gray-500"
                  >
                    <UIcon name="i-heroicons-check-circle" class="size-3" />
                    {{ checklistDone(task) }} / {{ task.checklistItems.length }}
                  </div>
                  <div
                    v-if="!task.deadline && !task.checklistItems.length"
                    class="text-xs text-gray-400"
                  >
                    —
                  </div>
                </div>
                <div v-if="task.assignments.length" class="flex -space-x-1">
                  <UiUserAvatar
                    v-for="a in task.assignments.slice(0, 3)"
                    :key="a.user.id"
                    :user="a.user"
                    size="md"
                    class="ring-2 ring-white dark:ring-gray-900"
                  />
                  <UBadge
                    v-if="task.assignments.length > 3"
                    color="neutral"
                    variant="soft"
                    size="md"
                    class="ring-2 ring-white dark:ring-gray-900"
                  >
                    +{{ task.assignments.length - 3 }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </div>

    <!-- Modales -->
    <TasksTaskGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="group"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />
    <TasksTaskTagsModal
      v-model:open="tagsModalOpen"
      :edition-id="editionId"
      :group-id="groupId"
      :tags="availableTags"
      @saved="fetchAvailableTags"
    />
    <TasksTaskModal
      v-if="group"
      v-model:open="taskModalOpen"
      :edition-id="editionId"
      :group="group"
      :task="editingTask"
      :assignable-users="assignableUsers"
      :task-groups="allGroups"
      :available-tags="availableTags"
      @saved="handleTaskSaved"
      @deleted="handleTaskDeleted"
      @task-updated="handleTaskUpdated"
    />
  </UContainer>
</template>

<script setup lang="ts">
import type { TaskFiltersValue } from '~/components/tasks/TaskFilters.vue'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const editionId = parseInt(route.params.id as string)
const groupId = computed(() => parseInt(route.params.groupId as string))

interface AssignableUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
}
interface TaskAssignment {
  id: number
  user: AssignableUser
}
interface ChecklistItem {
  id: number
  title: string
  done: boolean
  displayOrder: number
}
interface TagItem {
  id: number
  name: string
  color: string
}
interface TagAssignment {
  id: number
  tag: TagItem
}
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
interface TaskItem {
  id: number
  taskGroupId: number
  title: string
  description: string | null
  status: TaskStatus
  deadline: string | null
  displayOrder: number
  assignments: TaskAssignment[]
  checklistItems: ChecklistItem[]
  tagAssignments: TagAssignment[]
}
interface TaskGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  tasks: TaskItem[]
}

const allGroups = ref<TaskGroupItem[]>([])
const assignableUsers = ref<AssignableUser[]>([])
const availableTags = ref<TagItem[]>([])
const loading = ref(true)
const viewMode = ref<'list' | 'kanban'>('list')

const viewItems = computed(() => [
  { label: t('gestion.task.view_list'), value: 'list', icon: 'i-heroicons-list-bullet' },
  { label: t('gestion.task.view_kanban'), value: 'kanban', icon: 'i-heroicons-view-columns' },
])

const kanbanStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']

const group = computed<TaskGroupItem | null>(
  () => allGroups.value.find((g) => g.id === groupId.value) || null
)

// Titre de l'onglet : « {nom du groupe} – Tâches », cohérent avec la page liste /tasks.
// Tant que le groupe n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    group.value?.name ? `${group.value.name} – ${t('edition.tasks')}` : t('edition.tasks'),
})

// --- Filtres & recherche (persistés en URL via query params) ---
const VALID_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
const VALID_DUE = ['overdue', 'today', 'next7', 'next30', 'none'] as const

function parseInitialFilters(): TaskFiltersValue {
  // route.query.X peut être string | string[] | null — on coerce en string pour éviter
  // un plantage si l'URL contient plusieurs valeurs (ex: ?q=foo&q=bar).
  const queryParam = (v: unknown): string =>
    Array.isArray(v) ? String(v[0] ?? '') : v ? String(v) : ''
  const q = queryParam(route.query.q)
  const due = queryParam(route.query.due)
  const statusesRaw = queryParam(route.query.status)
  const assigneesRaw = queryParam(route.query.assignees)
  const tagsRaw = queryParam(route.query.tags)
  return {
    q,
    statuses: statusesRaw
      .split(',')
      .filter((s): s is TaskStatus => VALID_STATUSES.includes(s as TaskStatus)),
    assigneeIds: assigneesRaw
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n)),
    tagIds: tagsRaw
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n)),
    due: (VALID_DUE as readonly string[]).includes(due) ? (due as TaskFiltersValue['due']) : 'all',
  }
}

const filters = ref<TaskFiltersValue>(parseInitialFilters())

const hasDeadlines = computed<boolean>(() => !!group.value?.tasks.some((t) => t.deadline))

const legacyAssignees = computed<AssignableUser[]>(() => {
  if (!group.value) return []
  const knownIds = new Set(assignableUsers.value.map((u) => u.id))
  const map = new Map<number, AssignableUser>()
  for (const task of group.value.tasks) {
    for (const a of task.assignments) {
      if (!knownIds.has(a.user.id) && !map.has(a.user.id)) {
        map.set(a.user.id, a.user)
      }
    }
  }
  return Array.from(map.values())
})

const filteredTasks = computed<TaskItem[]>(() => {
  if (!group.value) return []
  let list = group.value.tasks

  const q = filters.value.q.toLowerCase()
  if (q) {
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ? t.description.toLowerCase().includes(q) : false)
    )
  }

  if (filters.value.statuses.length) {
    const set = new Set(filters.value.statuses)
    list = list.filter((t) => set.has(t.status))
  }

  if (filters.value.assigneeIds.length) {
    const set = new Set(filters.value.assigneeIds)
    list = list.filter((t) => t.assignments.some((a) => set.has(a.user.id)))
  }

  if (filters.value.tagIds.length) {
    const set = new Set(filters.value.tagIds)
    list = list.filter((t) => t.tagAssignments.some((a) => set.has(a.tag.id)))
  }

  const due = filters.value.due
  if (due && due !== 'all') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    list = list.filter((t) => {
      if (due === 'none') return t.deadline === null
      if (!t.deadline) return false
      const d = new Date(t.deadline)
      if (due === 'overdue') return d < now && t.status !== 'DONE' && t.status !== 'CANCELLED'
      if (due === 'today') {
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return day.getTime() === today.getTime()
      }
      if (due === 'next7' || due === 'next30') {
        const days = due === 'next7' ? 7 : 30
        const limit = new Date(today)
        limit.setDate(limit.getDate() + days)
        limit.setHours(23, 59, 59, 999)
        return d >= today && d <= limit
      }
      return true
    })
  }

  return list
})

// Synchronise les filtres vers l'URL (replace pour ne pas polluer l'historique).
watch(
  filters,
  (f) => {
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(route.query)) {
      if (typeof v === 'string') query[k] = v
    }
    if (f.q) query.q = f.q
    else delete query.q
    if (f.statuses.length) query.status = f.statuses.join(',')
    else delete query.status
    if (f.assigneeIds.length) query.assignees = f.assigneeIds.join(',')
    else delete query.assignees
    if (f.tagIds.length) query.tags = f.tagIds.join(',')
    else delete query.tags
    if (f.due && f.due !== 'all') query.due = f.due
    else delete query.due
    router.replace({ query })
  },
  { deep: true }
)

const fetchGroups = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { groups: TaskGroupItem[] } }>(
      `/api/editions/${editionId}/task-groups`
    )
    allGroups.value = res?.data?.groups || []
  } finally {
    loading.value = false
  }
}

const fetchAssignableUsers = async () => {
  const res = await $fetch<{ success: boolean; data: { users: AssignableUser[] } }>(
    `/api/editions/${editionId}/tasks/assignable-users`
  )
  assignableUsers.value = res?.data?.users || []
}

const fetchAvailableTags = async () => {
  try {
    const res = await $fetch<{ success: boolean; data: { tags: TagItem[] } }>(
      `/api/editions/${editionId}/task-groups/${groupId.value}/tags`
    )
    availableTags.value = res?.data?.tags || []
  } catch {
    // Si le groupe n'existe pas (ou autre erreur), on ignore.
    availableTags.value = []
  }
}

await Promise.all([fetchGroups(), fetchAssignableUsers(), fetchAvailableTags()])

// Refetch les tags si on change de groupId via navigation
watch(groupId, () => {
  fetchAvailableTags()
})

// Modales
const groupModalOpen = ref(false)
const tagsModalOpen = ref(false)
const taskModalOpen = ref(false)
const editingTask = ref<TaskItem | null>(null)

function openTaskModal(task: TaskItem | null) {
  editingTask.value = task
  taskModalOpen.value = true
}

const groupActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        groupModalOpen.value = true
      },
    },
    {
      label: t('gestion.task.tags.manage'),
      icon: 'i-heroicons-tag',
      onSelect: () => {
        tagsModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(),
    },
  ],
])

async function deleteGroup() {
  if (!group.value) return
  if (
    !confirm(
      t('gestion.task.confirm_delete_group', {
        name: group.value.name,
        count: group.value.tasks.length,
      })
    )
  )
    return
  await $fetch(`/api/editions/${editionId}/task-groups/${group.value.id}`, { method: 'DELETE' })
  router.push(`/editions/${editionId}/gestion/tasks`)
}

async function handleGroupSaved() {
  await fetchGroups()
}
async function handleGroupDeleted() {
  router.push(`/editions/${editionId}/gestion/tasks`)
}
async function handleTaskSaved() {
  await fetchGroups()
}
async function handleTaskDeleted() {
  await fetchGroups()
}
// Émis par TaskModal quand sa checklist change. Refetch en arrière-plan
// sans fermer le modal, et re-pointe editingTask vers la nouvelle référence
// pour que le modal reçoive les items à jour.
async function handleTaskUpdated() {
  const currentId = editingTask.value?.id
  await fetchGroups()
  if (currentId == null) return
  for (const g of allGroups.value) {
    const task = g.tasks.find((t) => t.id === currentId)
    if (task) {
      editingTask.value = task
      return
    }
  }
}

function statusColor(status: TaskStatus): 'neutral' | 'info' | 'success' | 'error' {
  switch (status) {
    case 'TODO':
      return 'neutral'
    case 'IN_PROGRESS':
      return 'info'
    case 'DONE':
      return 'success'
    case 'CANCELLED':
      return 'error'
  }
}

function tasksByStatus(status: TaskStatus): TaskItem[] {
  return filteredTasks.value.filter((t) => t.status === status)
}

function checklistDone(task: TaskItem): number {
  return task.checklistItems.filter((i) => i.done).length
}

// --- Drag & drop kanban (changement de status + réordonnancement) ---
const draggedTaskId = ref<number | null>(null)
const draggedFromStatus = ref<TaskStatus | null>(null)
const dragOverStatus = ref<TaskStatus | null>(null)
const dragOverTaskId = ref<number | null>(null)
const dragOverPosition = ref<'before' | 'after' | null>(null)
// Bloque le click synthétique émis juste après un drag (selon les navigateurs)
const justDragged = ref(false)

function onTaskClick(task: TaskItem) {
  if (justDragged.value) return
  openTaskModal(task)
}

function onTaskDragStart(task: TaskItem, event: DragEvent) {
  draggedTaskId.value = task.id
  draggedFromStatus.value = task.status
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(task.id))
  }
}

function onTaskDragEnd() {
  draggedTaskId.value = null
  draggedFromStatus.value = null
  dragOverStatus.value = null
  dragOverTaskId.value = null
  dragOverPosition.value = null
  // Court délai pour absorber le click synthétique qui suit parfois un drop
  justDragged.value = true
  setTimeout(() => {
    justDragged.value = false
  }, 50)
}

function onColumnDragOver(status: TaskStatus) {
  dragOverStatus.value = status
}

function onColumnDragLeave(status: TaskStatus, e: DragEvent) {
  // Ne reset que si on quitte vraiment la colonne (pas une carte enfant)
  const related = e.relatedTarget as Node | null
  const current = e.currentTarget as HTMLElement | null
  if (related && current && current.contains(related)) return
  if (dragOverStatus.value === status) dragOverStatus.value = null
}

async function changeTaskStatus(taskId: number, fromStatus: TaskStatus, newStatus: TaskStatus) {
  if (fromStatus === newStatus || !group.value) return
  const task = group.value.tasks.find((t) => t.id === taskId)
  if (!task) return
  // Mise à jour optimiste
  task.status = newStatus
  try {
    await $fetch(`/api/editions/${editionId}/tasks/${taskId}`, {
      method: 'PUT',
      body: { status: newStatus },
    })
  } catch (e: unknown) {
    // Revert en cas d'erreur API
    task.status = fromStatus
    const err = e as { data?: { message?: string } }
    useToast().add({
      title: err?.data?.message || t('errors.generic'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

async function onColumnDrop(status: TaskStatus) {
  const taskId = draggedTaskId.value
  const fromStatus = draggedFromStatus.value
  draggedTaskId.value = null
  draggedFromStatus.value = null
  dragOverStatus.value = null
  dragOverTaskId.value = null
  dragOverPosition.value = null
  if (!taskId || !fromStatus) return
  await changeTaskStatus(taskId, fromStatus, status)
}

// --- Drop sur une carte : réordonnancement intra-colonne ou changement de statut ---

function onCardDragOver(task: TaskItem, event: DragEvent) {
  // Uniquement pour le réordonnancement (même colonne).
  if (draggedFromStatus.value !== task.status) return
  if (draggedTaskId.value === task.id) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const midpoint = rect.top + rect.height / 2
  dragOverPosition.value = event.clientY < midpoint ? 'before' : 'after'
  dragOverTaskId.value = task.id
}

function onCardDragLeave(task: TaskItem) {
  if (dragOverTaskId.value === task.id) {
    dragOverTaskId.value = null
    dragOverPosition.value = null
  }
}

async function onCardDrop(task: TaskItem) {
  const draggedId = draggedTaskId.value
  const fromStatus = draggedFromStatus.value
  const position = dragOverPosition.value
  const targetStatus = task.status

  // Reset du state de drag immédiatement.
  draggedTaskId.value = null
  draggedFromStatus.value = null
  dragOverStatus.value = null
  dragOverTaskId.value = null
  dragOverPosition.value = null

  if (!draggedId || !fromStatus || !group.value) return
  if (draggedId === task.id) return

  // Cas 1 : drop sur une carte d'une autre colonne → changement de statut.
  if (fromStatus !== targetStatus) {
    await changeTaskStatus(draggedId, fromStatus, targetStatus)
    return
  }

  // Cas 2 : réordonnancement intra-colonne.
  const tasks = group.value.tasks
  const draggedIdx = tasks.findIndex((t) => t.id === draggedId)
  if (draggedIdx === -1) return

  // Calcule le nouvel ordre de la colonne (filtrée par statut).
  const columnTasks = tasksByStatus(targetStatus)
  const withoutDragged = columnTasks.filter((t) => t.id !== draggedId)
  const targetIdx = withoutDragged.findIndex((t) => t.id === task.id)
  if (targetIdx === -1) return
  const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
  const draggedTaskRef = tasks[draggedIdx]!
  const newColumnOrder = [
    ...withoutDragged.slice(0, insertIdx),
    draggedTaskRef,
    ...withoutDragged.slice(insertIdx),
  ]

  // Mise à jour optimiste : réorganise les tâches dans le tableau pour que le
  // filtre `tasksByStatus` reflète immédiatement le nouvel ordre.
  // Sauvegarde de l'ordre original pour revert en cas d'erreur.
  const originalOrder = [...tasks]
  // Retire les tâches de la colonne du tableau global.
  const columnTaskIds = new Set(columnTasks.map((t) => t.id))
  const otherTasks = tasks.filter((t) => !columnTaskIds.has(t.id))
  tasks.length = 0
  tasks.push(...otherTasks, ...newColumnOrder)

  try {
    await $fetch(`/api/editions/${editionId}/task-groups/${groupId.value}/reorder`, {
      method: 'POST',
      body: { taskIds: newColumnOrder.map((t) => t.id) },
    })
  } catch (e: unknown) {
    // Revert
    tasks.length = 0
    tasks.push(...originalOrder)
    const err = e as { data?: { message?: string } }
    useToast().add({
      title: err?.data?.message || t('errors.generic'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

function formatDeadline(d: string | null): string {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d))
  } catch {
    return d
  }
}

function deadlineClass(d: string | null, status: TaskStatus): string {
  if (!d || status === 'DONE' || status === 'CANCELLED') return 'text-gray-500'
  const now = new Date()
  const deadline = new Date(d)
  if (deadline < now) return 'text-red-600 dark:text-red-400 font-medium'
  const diffDays = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-500'
}
</script>
