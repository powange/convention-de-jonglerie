<template>
  <UModal
    v-model:open="isOpen"
    :title="task ? $t('gestion.tasks.edit_task') : $t('gestion.tasks.new_task')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.tasks.task_title')" required :error="fieldErrors.title">
          <UInput
            v-model="formData.title"
            :placeholder="$t('gestion.tasks.task_title_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.tasks.task_status')" :error="fieldErrors.status">
          <USelect v-model="formData.status" :items="statusItems" class="w-full" />
        </UFormField>

        <UFormField :label="$t('gestion.tasks.task_deadline')" :error="fieldErrors.deadline">
          <UiDateTimePicker v-model="formData.deadline" />
        </UFormField>

        <UFormField :label="$t('gestion.tasks.task_assignees')" :error="fieldErrors.assigneeIds">
          <USelectMenu
            v-model="selectedAssignees"
            :items="userItems"
            multiple
            :placeholder="$t('gestion.tasks.task_assignees_placeholder')"
            searchable
            :searchable-placeholder="$t('common.search')"
            class="w-full"
            :ui="{ content: 'min-w-fit' }"
          >
            <template #item-trailing="{ item }">
              <UBadge v-if="item.isLegacy" color="warning" variant="soft" size="xs">
                {{ $t('gestion.tasks.assignee_legacy_badge') }}
              </UBadge>
            </template>
          </USelectMenu>
          <p v-if="!assignableUsers.length" class="text-xs text-gray-500 mt-1">
            {{ $t('gestion.tasks.no_assignable_users') }}
          </p>
          <p v-if="hasLegacyAssignees" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {{ $t('gestion.tasks.legacy_assignees_warning') }}
          </p>
        </UFormField>

        <UFormField
          v-if="tagItems.length"
          :label="$t('gestion.tasks.task_tags')"
          :error="fieldErrors.tagIds"
        >
          <USelectMenu
            v-model="selectedTags"
            :items="tagItems"
            multiple
            :placeholder="$t('gestion.tasks.task_tags_placeholder')"
            searchable
            :searchable-placeholder="$t('common.search')"
            class="w-full"
            :ui="{ content: 'min-w-fit' }"
          >
            <template #default="{ modelValue: selected }">
              <span v-if="!selected?.length" class="text-gray-400">
                {{ $t('gestion.tasks.task_tags_placeholder') }}
              </span>
              <div v-else class="flex flex-wrap gap-1">
                <TasksTaskTagBadge
                  v-for="tg in selected"
                  :key="tg.value"
                  :tag="{ name: tg.label, color: tg.color }"
                />
              </div>
            </template>
            <template #item-leading="{ item }">
              <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: item.color }" />
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField :label="$t('gestion.tasks.task_description')" :error="fieldErrors.description">
          <MinimalMarkdownEditor v-model="formData.description" :rows="6" :can-edit="true" />
        </UFormField>

        <UFormField
          v-if="task && taskGroups.length > 1"
          :label="$t('gestion.tasks.move_to_group')"
          :error="fieldErrors.taskGroupId"
        >
          <USelect
            v-model="formData.taskGroupId"
            :items="taskGroups.map((g) => ({ label: g.name, value: g.id }))"
            class="w-full"
          />
        </UFormField>
      </form>

      <!-- Checklist (uniquement en édition) -->
      <div v-if="task" class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
        <TasksTaskChecklist
          :edition-id="editionId"
          :task-id="task.id"
          :items="task.checklistItems || []"
          :can-edit="true"
          @updated="emit('task-updated')"
        />
      </div>

      <!-- Commentaires (uniquement en édition) -->
      <div v-if="task" class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
        <TasksTaskComments
          :edition-id="editionId"
          :task-id="task.id"
          :can-post="true"
          :can-moderate="true"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton
          v-if="task"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :loading="deleting"
          @click="handleDelete"
        >
          {{ $t('common.delete') }}
        </UButton>
        <div v-else />
        <div class="flex gap-2">
          <UButton variant="ghost" color="neutral" @click="isOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="saving" @click="handleSubmit">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
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
  assignments: TaskAssignment[]
  checklistItems?: ChecklistItem[]
  tagAssignments?: TagAssignment[]
}
interface TaskGroupItem {
  id: number
  name: string
}

const props = defineProps<{
  open: boolean
  editionId: number
  group: TaskGroupItem | null
  task: TaskItem | null
  assignableUsers: AssignableUser[]
  taskGroups?: TaskGroupItem[]
  availableTags?: TagItem[]
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
  deleted: []
  'task-updated': []
}>()

const { t } = useI18n()
const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const taskGroups = computed(() => props.taskGroups || (props.group ? [props.group] : []))

const statusItems = computed(() =>
  (['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as TaskStatus[]).map((s) => ({
    label: t(`gestion.tasks.status.${s}`),
    value: s,
  }))
)

interface UserItem extends AssignableUser {
  label: string
  isLegacy?: boolean
  avatar: { src: string; alt: string; loading: 'lazy' }
}

const { getUserAvatar } = useAvatar()

function toUserItem(u: AssignableUser, isLegacy = false): UserItem {
  return {
    ...u,
    label: u.pseudo + (u.email ? ' — ' + u.email : ''),
    isLegacy,
    avatar: { src: getUserAvatar(u, 32), alt: u.pseudo, loading: 'lazy' },
  }
}

// Inclut les assignables actuels + les assignés "legacy" (plus dans la liste
// mais déjà assignés à la tâche en cours d'édition) pour qu'on ne les perde
// pas silencieusement à la sauvegarde.
const userItems = computed<UserItem[]>(() => {
  const baseItems = props.assignableUsers.map((u) => toUserItem(u, false))
  if (!props.task) return baseItems
  const knownIds = new Set(baseItems.map((u) => u.id))
  const legacyItems = props.task.assignments
    .filter((a) => !knownIds.has(a.user.id))
    .map((a) => toUserItem(a.user, true))
  return [...baseItems, ...legacyItems]
})

const formData = reactive({
  title: '',
  status: 'TODO' as TaskStatus,
  deadline: '' as string,
  description: '',
  taskGroupId: 0,
})
const selectedAssignees = ref<UserItem[]>([])
const hasLegacyAssignees = computed(() => selectedAssignees.value.some((u) => u.isLegacy))

interface TagSelectItem {
  label: string
  value: number
  color: string
}
const tagItems = computed<TagSelectItem[]>(() =>
  (props.availableTags || []).map((t) => ({ label: t.name, value: t.id, color: t.color }))
)
const selectedTags = ref<TagSelectItem[]>([])

const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const deleting = ref(false)

function resetFieldErrors() {
  fieldErrors.value = {}
}

watch(
  () => [props.open, props.task, props.group],
  ([open]) => {
    if (open) {
      formData.title = props.task?.title || ''
      formData.status = props.task?.status || 'TODO'
      formData.deadline = props.task?.deadline || ''
      formData.description = props.task?.description || ''
      formData.taskGroupId = props.task?.taskGroupId || props.group?.id || 0
      const assignedIds = props.task?.assignments.map((a) => a.user.id) || []
      selectedAssignees.value = userItems.value.filter((u) => assignedIds.includes(u.id))
      const tagIds = props.task?.tagAssignments?.map((a) => a.tag.id) || []
      selectedTags.value = tagItems.value.filter((tg) => tagIds.includes(tg.value))
      resetFieldErrors()
    }
  },
  { immediate: true }
)

function applyApiErrors(e: any): boolean {
  const errors = e?.data?.data?.errors || e?.data?.errors
  if (!errors || typeof errors !== 'object') return false
  const next: Record<string, string> = {}
  for (const [path, message] of Object.entries(errors as Record<string, string>)) {
    // Mappe assigneeIds.0 -> assigneeIds (erreur globale du tableau)
    const fieldName = path.split('.')[0]
    if (!next[fieldName]) next[fieldName] = message
  }
  fieldErrors.value = next
  return true
}

async function handleSubmit() {
  resetFieldErrors()
  if (!formData.title.trim()) {
    fieldErrors.value = { title: t('errors.required_field') }
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
      assigneeIds: selectedAssignees.value.map((u) => u.id),
      tagIds: selectedTags.value.map((t) => t.value),
    }
    if (props.task) {
      if (formData.taskGroupId && formData.taskGroupId !== props.task.taskGroupId) {
        body.taskGroupId = formData.taskGroupId
      }
      await $fetch(`/api/editions/${props.editionId}/tasks/${props.task.id}`, {
        method: 'PUT',
        body,
      })
    } else if (props.group) {
      await $fetch(`/api/editions/${props.editionId}/task-groups/${props.group.id}/tasks`, {
        method: 'POST',
        body,
      })
    }
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    const hasFieldErrors = applyApiErrors(e)
    useToast().add({
      title: hasFieldErrors
        ? e?.data?.data?.message || e?.data?.message || t('errors.validation_error')
        : e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.task) return
  if (!confirm(t('gestion.tasks.confirm_delete_task', { title: props.task.title }))) return
  deleting.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/tasks/${props.task.id}`, { method: 'DELETE' })
    useToast().add({
      title: t('common.deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('deleted')
    isOpen.value = false
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>
