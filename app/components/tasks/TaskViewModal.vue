<template>
  <UModal v-model:open="isOpen" :title="task?.title || ''" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="task" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="statusColor(task.status)" variant="soft" size="md">
            {{ $t(`gestion.tasks.status.${task.status}`) }}
          </UBadge>
          <UBadge
            v-if="task.group"
            color="neutral"
            variant="soft"
            size="md"
            icon="i-heroicons-folder"
          >
            {{ task.group.name }}
          </UBadge>
          <UBadge
            v-if="task.deadline"
            :color="deadlineBadgeColor"
            variant="soft"
            size="md"
            icon="i-heroicons-calendar"
          >
            {{ formatDeadline(task.deadline) }}
          </UBadge>
        </div>

        <div v-if="task.assignments.length">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ $t('gestion.tasks.task_assignees') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="a in task.assignments"
              :key="a.user.id"
              class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 px-2 py-1 rounded-full text-sm"
            >
              <UiUserAvatar :user="a.user" size="xs" />
              <span>{{ a.user.pseudo }}</span>
            </div>
          </div>
        </div>

        <div v-if="task.description">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ $t('gestion.tasks.task_description') }}
          </h3>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="prose prose-sm dark:prose-invert max-w-none" v-html="renderedDescription" />
        </div>

        <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
          <TasksTaskComments
            :edition-id="editionId"
            :task-id="task.id"
            :can-post="true"
            :can-moderate="false"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { markdownToHtml } from '~/utils/markdown'

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
  group: { id: number; name: string } | null
  assignments: TaskAssignment[]
}

const props = defineProps<{
  open: boolean
  editionId: number
  task: MyTaskItem | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
}>()

const { locale } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const renderedDescription = ref('')

watch(
  () => props.task?.description,
  async (desc) => {
    renderedDescription.value = desc ? await markdownToHtml(desc) : ''
  },
  { immediate: true }
)

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

const deadlineBadgeColor = computed<'neutral' | 'warning' | 'error'>(() => {
  if (!props.task?.deadline) return 'neutral'
  if (props.task.status === 'DONE' || props.task.status === 'CANCELLED') return 'neutral'
  const now = new Date()
  const deadline = new Date(props.task.deadline)
  if (deadline < now) return 'error'
  const diffDays = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return 'warning'
  return 'neutral'
})

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
</script>
