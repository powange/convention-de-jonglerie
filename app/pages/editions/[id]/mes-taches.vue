<template>
  <div>
    <div v-if="editionLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else>
      <EditionHeader :edition="edition" current-page="my-tasks" />

      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-clipboard-document-check" class="text-primary-500" />
            {{ $t('gestion.tasks.my_tasks.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ $t('gestion.tasks.my_tasks.description') }}
          </p>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
        </div>

        <div
          v-else-if="!tasks.length"
          class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
        >
          <UIcon name="i-heroicons-inbox" class="size-12 text-gray-400 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {{ $t('gestion.tasks.my_tasks.empty') }}
          </p>
        </div>

        <template v-else>
          <TasksTaskFilters
            v-model="filters"
            :assignable-users="[]"
            :has-deadlines="hasDeadlines"
            hide-assignees
          />

          <div
            v-if="!filteredTasks.length"
            class="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
          >
            <UIcon name="i-heroicons-funnel" class="size-8 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ $t('gestion.tasks.filters.no_match') }}
            </p>
          </div>

          <div v-else class="space-y-6">
            <div v-for="group in groupedTasks" :key="group.id">
              <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
                <UIcon name="i-heroicons-folder" class="text-gray-400 size-5" />
                {{ group.name }}
                <UBadge color="neutral" variant="soft" size="sm">{{ group.tasks.length }}</UBadge>
              </h2>
              <UCard>
                <ul class="divide-y divide-gray-100 dark:divide-gray-800">
                  <li
                    v-for="task in group.tasks"
                    :key="task.id"
                    class="py-2 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 px-2 -mx-2 rounded cursor-pointer"
                    @click="openTask(task)"
                  >
                    <UBadge
                      :color="statusColor(task.status)"
                      variant="soft"
                      size="md"
                      class="mt-0.5"
                    >
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
                    <div
                      v-if="otherAssignees(task).length"
                      class="flex items-center gap-1 shrink-0"
                      :title="
                        $t('gestion.tasks.my_tasks.with_others', {
                          names: otherAssignees(task)
                            .map((a) => a.user.pseudo)
                            .join(', '),
                        })
                      "
                    >
                      <span class="text-xs text-gray-500 hidden sm:inline">
                        {{ $t('gestion.tasks.my_tasks.with') }}
                      </span>
                      <div class="flex -space-x-1">
                        <UiUserAvatar
                          v-for="a in otherAssignees(task).slice(0, 3)"
                          :key="a.user.id"
                          :user="a.user"
                          size="md"
                          class="ring-2 ring-white dark:ring-gray-900"
                        />
                        <UBadge
                          v-if="otherAssignees(task).length > 3"
                          color="neutral"
                          variant="soft"
                          size="md"
                          class="ring-2 ring-white dark:ring-gray-900"
                        >
                          +{{ otherAssignees(task).length - 3 }}
                        </UBadge>
                      </div>
                    </div>
                  </li>
                </ul>
              </UCard>
            </div>
          </div>
        </template>
      </div>
    </div>

    <TasksTaskViewModal v-model:open="viewModalOpen" :edition-id="editionId" :task="selectedTask" />
  </div>
</template>

<script setup lang="ts">
import type { TaskFiltersValue } from '~/components/tasks/TaskFilters.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  middleware: ['auth-protected'],
})

interface AssignedUser {
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
  user: AssignedUser
}
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
interface MyTaskItem {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  deadline: string | null
  displayOrder: number
  group: { id: number; name: string } | null
  assignments: TaskAssignment[]
}

const route = useRoute()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)
if (Number.isNaN(editionId)) {
  throw createError({ statusCode: 404, statusMessage: 'Édition introuvable', fatal: true })
}

const editionLoading = computed(() => editionStore.loading)
const edition = computed(() => editionStore.getEditionById(editionId))

const tasks = ref<MyTaskItem[]>([])
const loading = ref(true)

const fetchTasks = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { tasks: MyTaskItem[] } }>(
      `/api/editions/${editionId}/tasks/mine`
    )
    tasks.value = res?.data?.tasks || []
  } catch (e: unknown) {
    // Si tasksEnabled est false ou édition introuvable, l'endpoint renvoie 404.
    const err = e as { statusCode?: number }
    if (err?.statusCode !== 404) throw e
    tasks.value = []
  } finally {
    loading.value = false
  }
}

// Fetch côté client uniquement : les cookies de session ne sont pas propagés
// automatiquement en SSR via $fetch — l'endpoint /tasks/mine retournerait 401.
// On charge aussi l'édition dans le store si l'URL est ouverte directement
// (sinon `getEditionById` retourne null et la page affiche « Édition introuvable »).
onMounted(async () => {
  const loadEdition = edition.value
    ? Promise.resolve()
    : editionStore.fetchEditionById(editionId, { force: true })
  await Promise.all([loadEdition, fetchTasks()])
})

// --- Filtres ---
const filters = ref<TaskFiltersValue>({
  q: '',
  statuses: [],
  assigneeIds: [],
  due: 'all',
})

const hasDeadlines = computed<boolean>(() => tasks.value.some((t) => t.deadline))

const filteredTasks = computed<MyTaskItem[]>(() => {
  let list = tasks.value

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

interface GroupedTasks {
  id: number
  name: string
  tasks: MyTaskItem[]
}

const groupedTasks = computed<GroupedTasks[]>(() => {
  const map = new Map<number, GroupedTasks>()
  for (const task of filteredTasks.value) {
    const gid = task.group?.id ?? 0
    const gname = task.group?.name ?? t('gestion.tasks.my_tasks.no_group')
    if (!map.has(gid)) map.set(gid, { id: gid, name: gname, tasks: [] })
    map.get(gid)!.tasks.push(task)
  }
  return Array.from(map.values())
})

// --- Modal ---
const viewModalOpen = ref(false)
const selectedTask = ref<MyTaskItem | null>(null)
function openTask(task: MyTaskItem) {
  selectedTask.value = task
  viewModalOpen.value = true
}

// --- Helpers d'affichage ---
function otherAssignees(task: MyTaskItem): TaskAssignment[] {
  const myId = authStore.user?.id
  return task.assignments.filter((a) => a.user.id !== myId)
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

function formatDeadline(d: string): string {
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
