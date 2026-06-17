<template>
  <UContainer class="py-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-clipboard-document-check" class="text-rose-500 size-6" />
        <h1 class="text-2xl font-semibold">{{ $t('edition.tasks') }}</h1>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openGroupModal(null)">
        {{ $t('gestion.task.new_group') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!groups.length"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon
        name="i-heroicons-clipboard-document-list"
        class="size-12 text-gray-400 mx-auto mb-3"
      />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.task.empty_state') }}
      </p>
      <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openGroupModal(null)">
        {{ $t('gestion.task.new_group') }}
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard
        v-for="group in groups"
        :key="group.id"
        class="cursor-pointer hover:shadow-md transition-shadow"
        @click="goToGroup(group.id)"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h2 class="font-semibold truncate">{{ group.name }}</h2>
            </div>
            <UDropdownMenu :items="getGroupActions(group)" @click.stop>
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                variant="ghost"
                color="neutral"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </template>

        <p
          v-if="group.description"
          class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 min-h-12"
        >
          {{ group.description }}
        </p>
        <p v-else class="text-sm text-gray-400 italic min-h-12">
          {{ $t('gestion.task.group_description_empty') }}
        </p>

        <template #footer>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2 text-gray-500">
              <UIcon name="i-heroicons-clipboard-document-list" class="size-4" />
              {{
                $t('gestion.task.tasks_count', { count: group.tasks.length }, group.tasks.length)
              }}
            </div>
            <div class="flex items-center gap-1 text-primary-500">
              <span>{{ $t('common.view_more') }}</span>
              <UIcon name="i-heroicons-arrow-right" class="size-4" />
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <TasksTaskGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="editingGroup"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
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
const { t } = useI18n()
const editionId = parseInt(route.params.id as string)

// Titre de l'onglet : « Tâches » (référence de la section, repris par la page d'un groupe).
useSeoMeta({
  title: () => t('edition.tasks'),
})

interface TaskGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  tasks: { id: number }[]
}

const groups = ref<TaskGroupItem[]>([])
const loading = ref(true)

const fetchGroups = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { groups: TaskGroupItem[] } }>(
      `/api/editions/${editionId}/task-groups`
    )
    groups.value = res?.data?.groups || []
  } finally {
    loading.value = false
  }
}

await fetchGroups()

const groupModalOpen = ref(false)
const editingGroup = ref<TaskGroupItem | null>(null)

function openGroupModal(group: TaskGroupItem | null) {
  editingGroup.value = group
  groupModalOpen.value = true
}

function goToGroup(groupId: number) {
  router.push(`/editions/${editionId}/gestion/tasks/${groupId}`)
}

const getGroupActions = (group: TaskGroupItem) => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openGroupModal(group),
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(group),
    },
  ],
]

async function deleteGroup(group: TaskGroupItem) {
  if (
    !confirm(
      t('gestion.task.confirm_delete_group', { name: group.name, count: group.tasks.length })
    )
  )
    return
  await $fetch(`/api/editions/${editionId}/task-groups/${group.id}`, { method: 'DELETE' })
  await fetchGroups()
}

async function handleGroupSaved() {
  await fetchGroups()
}
async function handleGroupDeleted() {
  await fetchGroups()
}
</script>
