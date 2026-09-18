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
                <!-- Le titre revient à la ligne plutôt que d'être coupé : `truncate` masquait la
                     fin des titres longs, et c'est souvent là qu'est le détail qui distingue deux
                     tâches. `break-words` coupe aussi un mot unique interminable, qui déborderait
                     sinon de la colonne. Signalé par un organisateur. -->
                <div class="font-medium text-sm break-words">{{ task.title }}</div>
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
          :data-zone-reordonnable="status"
          class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 min-h-50 transition-colors"
          :class="
            reordre.zoneSurvolee.value === status && reordre.enCours.value
              ? 'ring-2 ring-primary-500'
              : ''
          "
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
            <!-- `touch-action: none` est la condition sine qua non du glissement au doigt : sans
                 lui, le navigateur interprète le geste comme un défilement et cesse d'émettre des
                 `pointermove`. Il n'est posé que si l'on peut réordonner, faute de quoi on
                 confisquerait le défilement à qui ne fait que lire son tableau. -->
            <UCard
              v-for="task in tasksByStatus(status)"
              :key="task.id"
              :data-reordonnable="task.id"
              :class="[
                'hover:shadow-md transition-all',
                'cursor-grab active:cursor-grabbing',
                reordre.cleSaisie.value === task.id ? 'opacity-50' : '',
                reordre.cleSurvolee.value === task.id && reordre.cote.value === 'avant'
                  ? 'border-t-2 border-t-primary-500'
                  : '',
                reordre.cleSurvolee.value === task.id && reordre.cote.value === 'apres'
                  ? 'border-b-2 border-b-primary-500'
                  : '',
              ]"
              :style="{ touchAction: 'none' }"
              :ui="{ body: 'p-3' }"
              @click="onTaskClick(task)"
              @pointerdown="saisirTache(task, $event)"
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
      :task-groups="resumesDesGroupes"
      :available-tags="availableTags"
      @saved="handleTaskSaved"
      @deleted="handleTaskDeleted"
      @task-updated="handleTaskUpdated"
    />

    <UiConfirmModal
      v-model="confirmationGroupeOuverte"
      :title="t('gestion.task.delete_group')"
      :description="
        group
          ? t('gestion.task.confirm_delete_group', {
              name: group.name,
              count: group.tasks.length,
            })
          : ''
      "
      :confirm-label="t('common.delete')"
      confirm-color="error"
      :loading="suppressionGroupeEnCours"
      @confirm="supprimerGroupe"
      @cancel="confirmationGroupeOuverte = false"
    />
  </UContainer>
</template>

<script setup lang="ts">
// Composant frère du même layer → import relatif (le type n'est pas exposé par #components).
import type { TaskFiltersValue, TaskSort } from '../../../../../components/tasks/TaskFilters.vue'

import { valeurDepuisUrl } from '~~/shared/utils/filtres-url'
import { contientLaSaisie } from '~~/shared/utils/recherche-texte'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDateShortMonth } = useDateFormat()
const editionId = parseInt(route.params.id as string)
const groupId = computed(() => parseInt(route.params.groupId as string))

/**
 * Une personne telle qu'une ASSIGNATION la porte.
 *
 * Sans adresse e-mail : le point d'API des groupes ne la transmet plus, parce qu'aucun écran ne
 * l'affichait et qu'elle partait jusqu'à des bénévoles simplement co-assignés.
 */
interface AssignedUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  emailHash: string | null
  profilePicture: string | null
}

/**
 * Une personne à QUI l'on peut assigner, telle que `assignable-users` la rend.
 *
 * Distincte de la précédente pour la seule raison qui compte : celle-ci porte l'adresse e-mail,
 * que le sélecteur d'assignation affiche à côté du pseudo pour départager deux homonymes. Un type
 * unique pour les deux sources ferait promettre à l'une ce que l'autre ne livre pas.
 */
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
  user: AssignedUser
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

/** Un groupe tel que la liste le rend désormais : sans ses tâches, avec leur nombre. */
interface ResumeDeGroupe {
  id: number
  name: string
  description: string | null
  displayOrder: number
  _count: { tasks: number }
}

/**
 * Le groupe affiché, avec tout son contenu — et lui seul.
 *
 * ⚠️ Cette page chargeait auparavant TOUS les groupes de l'édition avec leurs tâches, leurs
 * assignés, leurs checklists et leurs étiquettes, pour en retenir un et jeter le reste. Et elle
 * recommençait après chaque action : cocher une case rechargeait le tableau de toute l'édition.
 */
const group = ref<TaskGroupItem | null>(null)

/**
 * Les autres groupes, en résumé.
 *
 * Utilisés pour une seule chose — le sélecteur « déplacer vers un autre groupe » de la modale d'une
 * tâche — qui n'a besoin que d'un identifiant et d'un nom.
 */
const resumesDesGroupes = ref<ResumeDeGroupe[]>([])
const assignableUsers = ref<AssignableUser[]>([])
const availableTags = ref<TagItem[]>([])
const loading = ref(true)
/**
 * Le mode d'affichage, conservé dans l'URL au même titre que les filtres.
 *
 * C'est un choix de lecture aussi durable qu'un filtre — on travaille en kanban, ou on ne le fait
 * pas — et le seul réglage de cet écran qui ne survivait ni au rechargement ni au lien envoyé.
 */
const VUES_DES_TACHES = ['list', 'kanban'] as const
const viewMode = ref<'list' | 'kanban'>(
  valeurDepuisUrl(route.query.view, VUES_DES_TACHES, VUES_DES_TACHES[0])
)

const viewItems = computed(() => [
  { label: t('gestion.task.view_list'), value: 'list', icon: 'i-heroicons-list-bullet' },
  { label: t('gestion.task.view_kanban'), value: 'kanban', icon: 'i-heroicons-view-columns' },
])

const kanbanStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']

// Titre de l'onglet : « {nom du groupe} – Tâches », cohérent avec la page liste /tasks.
// Tant que le groupe n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    group.value?.name ? `${group.value.name} – ${t('edition.tasks')}` : t('edition.tasks'),
})

// --- Filtres & recherche (persistés en URL via query params) ---
const VALID_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
const VALID_DUE = ['overdue', 'today', 'next7', 'next30', 'none'] as const
const VALID_SORTS = ['manual', 'deadline_asc', 'deadline_desc'] as const

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
  const sort = queryParam(route.query.sort)
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
    sort: (VALID_SORTS as readonly string[]).includes(sort) ? (sort as TaskSort) : 'manual',
  }
}

const filters = ref<TaskFiltersValue>(parseInitialFilters())

const hasDeadlines = computed<boolean>(() => !!group.value?.tasks.some((t) => t.deadline))

const legacyAssignees = computed<AssignedUser[]>(() => {
  if (!group.value) return []
  const knownIds = new Set(assignableUsers.value.map((u) => u.id))
  const map = new Map<number, AssignedUser>()
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

  // Accents et casse ignorés : sur un clavier de téléphone, taper « reserver » pour trouver
  // « Réserver la salle » est le cas courant, pas l'exception.
  if (filters.value.q.trim()) {
    list = list.filter((t) => contientLaSaisie(filters.value.q, t.title, t.description))
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

  // Le tri vient après le filtrage : on ordonne ce qui reste, pas ce qui a été écarté.
  //
  // Les tâches sans échéance vont toujours à la fin, dans les deux sens. Les remonter en tête
  // du tri décroissant — ce que ferait un comparateur naïf sur `null` — laisserait croire
  // qu'elles sont les plus lointaines, alors qu'elles n'ont simplement pas de date.
  //
  // `slice()` avant de trier : `sort` modifie le tableau en place, et celui-ci vient d'un
  // computed dérivé des données du groupe.
  if (filters.value.sort !== 'manual') {
    const sens = filters.value.sort === 'deadline_asc' ? 1 : -1
    list = list.slice().sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return (new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) * sens
    })
  }

  return list
})

// Synchronise les filtres vers l'URL (replace pour ne pas polluer l'historique).
watch(
  [filters, viewMode],
  ([f]) => {
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(route.query)) {
      if (typeof v === 'string') query[k] = v
    }
    // Le mode liste est l'état d'arrivée : l'écrire allongerait l'URL sans rien dire.
    if (viewMode.value !== VUES_DES_TACHES[0]) query.view = viewMode.value
    else delete query.view
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
    if (f.sort && f.sort !== 'manual') query.sort = f.sort
    else delete query.sort
    router.replace({ query })
  },
  { deep: true }
)

const fetchGroups = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { group: TaskGroupItem } }>(
      `/api/editions/${editionId}/task-groups/${groupId.value}`
    )
    group.value = res?.data?.group ?? null
  } catch {
    // Groupe supprimé ou inaccessible : l'écran affiche déjà son message d'absence.
    group.value = null
  } finally {
    loading.value = false
  }
}

/**
 * Les résumés ne servent qu'au sélecteur de déplacement : ils se chargent une fois, et se
 * rafraîchissent quand un groupe est créé ou renommé — pas à chaque coche de checklist.
 */
const fetchResumesDesGroupes = async () => {
  const res = await $fetch<{ success: boolean; data: { groups: ResumeDeGroupe[] } }>(
    `/api/editions/${editionId}/task-groups`
  )
  resumesDesGroupes.value = res?.data?.groups || []
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

await Promise.all([
  fetchGroups(),
  fetchResumesDesGroupes(),
  fetchAssignableUsers(),
  fetchAvailableTags(),
])

// Changer de groupe par navigation : son contenu et ses étiquettes suivent.
watch(groupId, () => {
  fetchGroups()
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

const confirmationGroupeOuverte = ref(false)
const suppressionGroupeEnCours = ref(false)

function deleteGroup() {
  if (!group.value) return
  confirmationGroupeOuverte.value = true
}

async function supprimerGroupe() {
  // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant. Ici,
  // le succès quitte la page — la refermer serait de toute façon sans objet.
  const groupe = group.value
  if (!groupe) return

  suppressionGroupeEnCours.value = true
  try {
    await $fetch(`/api/editions/${editionId}/task-groups/${groupe.id}`, { method: 'DELETE' })
    router.push(`/editions/${editionId}/gestion/tasks`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    useToast().add({
      title: err?.data?.message || t('errors.generic'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    suppressionGroupeEnCours.value = false
  }
}

async function handleGroupSaved() {
  await Promise.all([fetchGroups(), fetchResumesDesGroupes()])
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
  // La recherche se fait dans le seul groupe chargé : une tâche dont la checklist vient de changer
  // n'a pas changé de groupe — un déplacement passe par `handleTaskSaved`, qui ferme la modale.
  const task = group.value?.tasks.find((t) => t.id === currentId)
  if (task) editingTask.value = task
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
/**
 * Réordonner suppose que ce qu'on voit EST l'ordre enregistré.
 *
 * Les colonnes du kanban affichent `filteredTasks`, tri compris. Sous un tri par échéance, le
 * nouvel ordre envoyé à `/reorder` serait donc l'ordre des dates, et non l'ordre manuel avec une
 * carte déplacée : le glisser-déposer écrasait silencieusement les positions enregistrées par
 * celles du tri. Constaté sur un cas réel — l'ordre passait de `[Proche, Sans date, Moyenne,
 * Lointaine]` à `[Moyenne, Lointaine, Proche, Sans date]` pour un simple déplacement.
 *
 * Le changement de STATUT reste possible : il ne touche pas aux positions.
 */
const triActif = computed(() => filters.value.sort !== 'manual')

/**
 * Le glisser-déposer du kanban : changer de colonne, et réordonner dans une colonne.
 *
 * ⚠️ Par *pointer events* et non par le glisser-déposer HTML5, que les navigateurs mobiles
 * n'émettent pas au toucher : le tableau était inerte sur téléphone et tablette, alors qu'une
 * convention se prépare en marchant. Le détail des précautions — seuil de saisie, défilement
 * automatique, clic parasite — vit dans le composable, partagé avec la liste des groupes.
 */
/**
 * La colonne d'où part la carte saisie.
 *
 * Retenue au moment de la saisie plutôt que relue depuis le composable : `elements()` aurait eu
 * besoin de `reordre` avant que `reordre` soit construit, et TypeScript refuse à juste titre une
 * variable qui se lit dans sa propre définition.
 */
const statutSaisi = ref<TaskStatus | null>(null)

function saisirTache(task: TaskItem, event: PointerEvent) {
  statutSaisi.value = task.status
  reordre.auPointerDown(task, event)
}

const reordre = useReordonnancementTactile<TaskItem>({
  // On réordonne DANS la colonne de départ : les autres colonnes ne sont pas concernées.
  elements: () => (statutSaisi.value ? tasksByStatus(statutSaisi.value) : []),
  cle: (task) => task.id,
  auDepot: async (ordreFinal, deplace, zone) => {
    const statutVise = (zone ?? deplace.status) as TaskStatus

    // Cas 1 : la carte change de colonne. Le rang ne bouge pas — changer les deux à la fois
    // demanderait deux écritures dont la seconde pourrait échouer seule.
    if (statutVise !== deplace.status) {
      await changeTaskStatus(deplace.id, deplace.status, statutVise)
      return
    }

    // Cas 2 : réordonnancement dans la colonne, impossible tant qu'un tri est actif — voir le
    // commentaire au-dessus de `triActif`, qui explique le dégât que cela causait.
    if (triActif.value) {
      useToast().add({
        title: t('gestion.task.reorder_requires_manual_sort'),
        icon: 'i-heroicons-arrows-up-down',
        color: 'warning',
      })
      return
    }

    const taches = group.value?.tasks
    if (!taches) return

    // Mise à jour optimiste : les cartes de la colonne sont retirées du tableau du groupe, puis
    // remises dans leur nouvel ordre, pour que `tasksByStatus` reflète immédiatement le dépôt.
    const ordrePrecedent = [...taches]
    const idsDeLaColonne = new Set(ordreFinal.map((t) => t.id))
    const autres = taches.filter((t) => !idsDeLaColonne.has(t.id))
    taches.length = 0
    taches.push(...autres, ...ordreFinal)

    try {
      await $fetch(`/api/editions/${editionId}/task-groups/${groupId.value}/reorder`, {
        method: 'POST',
        body: { taskIds: ordreFinal.map((t) => t.id) },
      })
    } catch (e: unknown) {
      taches.length = 0
      taches.push(...ordrePrecedent)
      const err = e as { data?: { message?: string } }
      useToast().add({
        title: err?.data?.message || t('errors.generic'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  },
})

/** Ouvrir une tâche, sauf si l'on vient de la déplacer : un `click` suit chaque relâchement. */
function onTaskClick(task: TaskItem) {
  if (reordre.vientDeGlisser.value) return
  openTaskModal(task)
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

function formatDeadline(d: string | null): string {
  if (!d) return ''
  try {
    return formatDateShortMonth(d)
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
