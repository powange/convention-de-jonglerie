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
        {{ $t('gestion.tasks.title') }}
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
        {{ $t('gestion.tasks.group_not_found') }}
      </p>
      <UButton
        :to="`/editions/${editionId}/gestion/tasks`"
        icon="i-heroicons-arrow-left"
        color="primary"
        size="sm"
      >
        {{ $t('gestion.tasks.title') }}
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
              {{ $t('gestion.tasks.new_task') }}
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

      <!-- Vue Liste -->
      <div v-if="viewMode === 'list'">
        <div
          v-if="!group.tasks.length"
          class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
        >
          <UIcon name="i-heroicons-inbox" class="size-10 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            {{ $t('gestion.tasks.empty_group') }}
          </p>
          <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openTaskModal(null)">
            {{ $t('gestion.tasks.new_task') }}
          </UButton>
        </div>
        <UCard v-else>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="task in group.tasks"
              :key="task.id"
              class="py-2 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 px-2 -mx-2 rounded cursor-pointer"
              @click="openTaskModal(task)"
            >
              <UBadge :color="statusColor(task.status)" variant="soft" size="md" class="mt-0.5">
                {{ $t(`gestion.tasks.status.${task.status}`) }}
              </UBadge>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">{{ task.title }}</div>
                <div
                  v-if="task.deadline"
                  class="text-xs mt-0.5 flex items-center gap-1"
                  :class="deadlineClass(task.deadline, task.status)"
                >
                  <UIcon name="i-heroicons-calendar" class="size-3" />
                  {{ formatDeadline(task.deadline) }}
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
                {{ $t(`gestion.tasks.status.${status}`) }}
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
              ]"
              :ui="{ body: 'p-3' }"
              @click="onTaskClick(task)"
              @dragstart="onTaskDragStart(task, $event)"
              @dragend="onTaskDragEnd"
            >
              <div class="font-medium text-sm mb-2">{{ task.title }}</div>
              <div class="flex items-center justify-between gap-2">
                <div
                  v-if="task.deadline"
                  class="text-xs flex items-center gap-1"
                  :class="deadlineClass(task.deadline, task.status)"
                >
                  <UIcon name="i-heroicons-calendar" class="size-3" />
                  {{ formatDeadline(task.deadline) }}
                </div>
                <div v-else class="text-xs text-gray-400">—</div>
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
    <TasksTaskModal
      v-if="group"
      v-model:open="taskModalOpen"
      :edition-id="editionId"
      :group="group"
      :task="editingTask"
      :assignable-users="assignableUsers"
      :task-groups="allGroups"
      @saved="handleTaskSaved"
      @deleted="handleTaskDeleted"
    />
  </UContainer>
</template>

<script setup lang="ts">
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
const loading = ref(true)
const viewMode = ref<'list' | 'kanban'>('list')

const viewItems = computed(() => [
  { label: t('gestion.tasks.view_list'), value: 'list', icon: 'i-heroicons-list-bullet' },
  { label: t('gestion.tasks.view_kanban'), value: 'kanban', icon: 'i-heroicons-view-columns' },
])

const kanbanStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']

const group = computed<TaskGroupItem | null>(
  () => allGroups.value.find((g) => g.id === groupId.value) || null
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

await Promise.all([fetchGroups(), fetchAssignableUsers()])

// Modales
const groupModalOpen = ref(false)
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
      t('gestion.tasks.confirm_delete_group', {
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
  if (!group.value) return []
  return group.value.tasks.filter((t) => t.status === status)
}

// --- Drag & drop kanban (changement de status) ---
const draggedTaskId = ref<number | null>(null)
const draggedFromStatus = ref<TaskStatus | null>(null)
const dragOverStatus = ref<TaskStatus | null>(null)
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

async function onColumnDrop(status: TaskStatus) {
  const taskId = draggedTaskId.value
  const fromStatus = draggedFromStatus.value
  draggedTaskId.value = null
  draggedFromStatus.value = null
  dragOverStatus.value = null
  if (!taskId || !group.value || fromStatus === status) return
  const task = group.value.tasks.find((t) => t.id === taskId)
  if (!task) return
  // Mise à jour optimiste
  task.status = status
  try {
    await $fetch(`/api/editions/${editionId}/tasks/${taskId}`, {
      method: 'PUT',
      body: { status },
    })
  } catch (e: any) {
    // Revert en cas d'erreur API
    task.status = fromStatus!
    useToast().add({
      title: e?.data?.message || t('errors.generic'),
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
