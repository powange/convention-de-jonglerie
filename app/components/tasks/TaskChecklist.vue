<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ $t('gestion.tasks.checklist.title') }}
        <span v-if="localItems.length" class="text-xs text-gray-500 ml-2">
          {{ doneCount }} / {{ localItems.length }}
        </span>
      </h3>
    </div>

    <ul v-if="localItems.length" class="space-y-1">
      <li v-for="item in localItems" :key="item.id" class="flex items-center gap-2 group">
        <UCheckbox
          :model-value="item.done"
          :disabled="!canEdit || togglingIds.has(item.id)"
          @update:model-value="(v) => toggleItem(item, !!v)"
        />
        <template v-if="editingItemId === item.id">
          <UInput
            v-model="editingTitle"
            size="sm"
            class="flex-1"
            autofocus
            @keydown.enter="saveEdit(item)"
            @keydown.escape="cancelEdit"
          />
          <UButton
            icon="i-heroicons-check"
            size="xs"
            color="primary"
            variant="ghost"
            :loading="savingEdit"
            @click="saveEdit(item)"
          />
          <UButton
            icon="i-heroicons-x-mark"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="cancelEdit"
          />
        </template>
        <template v-else>
          <span class="flex-1 text-sm" :class="item.done ? 'line-through text-gray-400' : ''">
            {{ item.title }}
          </span>
          <UButton
            v-if="canEdit"
            icon="i-heroicons-pencil-square"
            size="xs"
            color="neutral"
            variant="ghost"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
            @click="startEdit(item)"
          />
          <UButton
            v-if="canEdit"
            icon="i-heroicons-trash"
            size="xs"
            color="error"
            variant="ghost"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
            :loading="deletingIds.has(item.id)"
            @click="deleteItem(item)"
          />
        </template>
      </li>
    </ul>
    <p v-else class="text-xs text-gray-500">
      {{ $t('gestion.tasks.checklist.empty') }}
    </p>

    <div v-if="canEdit" class="flex items-center gap-2 pt-1">
      <UInput
        v-model="newItemTitle"
        :placeholder="$t('gestion.tasks.checklist.add_placeholder')"
        size="sm"
        class="flex-1"
        @keydown.enter="addItem"
      />
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        :disabled="!newItemTitle.trim()"
        :loading="adding"
        @click="addItem"
      >
        {{ $t('gestion.tasks.checklist.add') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ChecklistItem {
  id: number
  title: string
  done: boolean
  displayOrder: number
}

const props = defineProps<{
  editionId: number
  taskId: number
  items: ChecklistItem[]
  canEdit: boolean
}>()

const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()
const toast = useToast()

const localItems = ref<ChecklistItem[]>([...props.items])
const newItemTitle = ref('')
const adding = ref(false)
const editingItemId = ref<number | null>(null)
const editingTitle = ref('')
const savingEdit = ref(false)
const togglingIds = ref(new Set<number>())
const deletingIds = ref(new Set<number>())

const doneCount = computed(() => localItems.value.filter((i) => i.done).length)

// Si la liste d'items change côté parent, resynchronise.
watch(
  () => props.items,
  (next) => {
    localItems.value = [...next]
  }
)

function notifyError(e: unknown) {
  const err = e as { data?: { message?: string } }
  toast.add({
    title: err?.data?.message || t('errors.generic'),
    icon: 'i-heroicons-exclamation-circle',
    color: 'error',
  })
}

async function addItem() {
  const title = newItemTitle.value.trim()
  if (!title) return
  adding.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { item: ChecklistItem } }>(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/checklist-items`,
      { method: 'POST', body: { title } }
    )
    if (res?.data?.item) {
      localItems.value.push(res.data.item)
      newItemTitle.value = ''
      emit('updated')
    }
  } catch (e) {
    notifyError(e)
  } finally {
    adding.value = false
  }
}

async function toggleItem(item: ChecklistItem, done: boolean) {
  togglingIds.value.add(item.id)
  const previous = item.done
  item.done = done
  try {
    await $fetch(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/checklist-items/${item.id}`,
      { method: 'PUT', body: { done } }
    )
    emit('updated')
  } catch (e) {
    item.done = previous
    notifyError(e)
  } finally {
    togglingIds.value.delete(item.id)
  }
}

function startEdit(item: ChecklistItem) {
  editingItemId.value = item.id
  editingTitle.value = item.title
}

function cancelEdit() {
  editingItemId.value = null
  editingTitle.value = ''
}

async function saveEdit(item: ChecklistItem) {
  const title = editingTitle.value.trim()
  if (!title || title === item.title) {
    cancelEdit()
    return
  }
  savingEdit.value = true
  try {
    await $fetch(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/checklist-items/${item.id}`,
      { method: 'PUT', body: { title } }
    )
    item.title = title
    cancelEdit()
    emit('updated')
  } catch (e) {
    notifyError(e)
  } finally {
    savingEdit.value = false
  }
}

async function deleteItem(item: ChecklistItem) {
  if (!confirm(t('gestion.tasks.checklist.confirm_delete', { title: item.title }))) return
  deletingIds.value.add(item.id)
  try {
    await $fetch(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/checklist-items/${item.id}`,
      { method: 'DELETE' }
    )
    localItems.value = localItems.value.filter((i) => i.id !== item.id)
    emit('updated')
  } catch (e) {
    notifyError(e)
  } finally {
    deletingIds.value.delete(item.id)
  }
}
</script>
