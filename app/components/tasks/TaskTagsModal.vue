<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('gestion.task.tags.modal_title')"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.task.tags.description') }}
        </p>

        <!-- Liste des tags existants -->
        <ul v-if="localTags.length" class="space-y-1">
          <li v-for="tag in localTags" :key="tag.id" class="group">
            <template v-if="editingId === tag.id">
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="w-4 h-4 rounded-full shrink-0"
                  :style="{ backgroundColor: editingColor }"
                />
                <UInput
                  v-model="editingName"
                  size="sm"
                  class="flex-1"
                  autofocus
                  @keydown.enter="saveEdit(tag)"
                  @keydown.escape="cancelEdit"
                />
                <UButton
                  icon="i-heroicons-check"
                  size="xs"
                  color="primary"
                  variant="ghost"
                  :loading="saving"
                  @click="saveEdit(tag)"
                />
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="cancelEdit"
                />
              </div>
              <UiColorPicker
                v-model="editingColor"
                :palette="colors"
                format="hex"
                size="sm"
                :columns="colors.length"
                allow-custom
              />
            </template>
            <div v-else class="flex items-center gap-2">
              <TasksTaskTagBadge :tag="tag" size="sm" class="flex-1 max-w-fit" />
              <UButton
                icon="i-heroicons-pencil-square"
                size="xs"
                color="neutral"
                variant="ghost"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="startEdit(tag)"
              />
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                color="error"
                variant="ghost"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                :loading="deletingIds.has(tag.id)"
                @click="deleteTag(tag)"
              />
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500 italic">
          {{ $t('gestion.task.tags.empty') }}
        </p>

        <!-- Création d'un nouveau tag -->
        <div class="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <h4 class="text-sm font-medium">{{ $t('gestion.task.tags.new_tag') }}</h4>
          <div class="flex items-center gap-2">
            <UInput
              v-model="newTagName"
              :placeholder="$t('gestion.task.tags.name_placeholder')"
              size="sm"
              class="flex-1"
              @keydown.enter="addTag"
            />
          </div>
          <UiColorPicker
            v-model="newTagColor"
            :palette="colors"
            format="hex"
            size="sm"
            :columns="colors.length"
            allow-custom
          />
          <div class="flex justify-end">
            <UButton
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              :disabled="!newTagName.trim()"
              :loading="adding"
              @click="addTag"
            >
              {{ $t('common.add') }}
            </UButton>
          </div>
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
import { DEFAULT_HEX_PALETTE } from '~/utils/default-palette'

interface TagItem {
  id: number
  name: string
  color: string
  displayOrder: number
}

const props = defineProps<{
  open: boolean
  editionId: number
  groupId: number
  tags: TagItem[]
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const colors = [...DEFAULT_HEX_PALETTE]

const localTags = ref<TagItem[]>([...props.tags])
watch(
  () => props.tags,
  (next) => {
    localTags.value = [...next]
  }
)

const newTagName = ref('')
const newTagColor = ref<string>(colors[0]!)
const adding = ref(false)

const editingId = ref<number | null>(null)
const editingName = ref('')
const editingColor = ref<string>(colors[0]!)
const saving = ref(false)
const deletingIds = ref(new Set<number>())

function notifyError(e: unknown) {
  const err = e as { data?: { message?: string } }
  toast.add({
    title: err?.data?.message || t('errors.generic'),
    icon: 'i-heroicons-exclamation-circle',
    color: 'error',
  })
}

async function addTag() {
  const name = newTagName.value.trim()
  if (!name) return
  adding.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { tag: TagItem } }>(
      `/api/editions/${props.editionId}/task-groups/${props.groupId}/tags`,
      { method: 'POST', body: { name, color: newTagColor.value } }
    )
    if (res?.data?.tag) {
      localTags.value.push(res.data.tag)
      newTagName.value = ''
      emit('saved')
    }
  } catch (e) {
    notifyError(e)
  } finally {
    adding.value = false
  }
}

function startEdit(tag: TagItem) {
  editingId.value = tag.id
  editingName.value = tag.name
  editingColor.value = tag.color || 'gray'
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function saveEdit(tag: TagItem) {
  const name = editingName.value.trim()
  if (!name) return
  if (name === tag.name && editingColor.value === tag.color) {
    cancelEdit()
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { tag: TagItem } }>(
      `/api/editions/${props.editionId}/task-groups/${props.groupId}/tags/${tag.id}`,
      { method: 'PUT', body: { name, color: editingColor.value } }
    )
    if (res?.data?.tag) {
      const idx = localTags.value.findIndex((t) => t.id === tag.id)
      if (idx >= 0) localTags.value[idx] = res.data.tag
      cancelEdit()
      emit('saved')
    }
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}

async function deleteTag(tag: TagItem) {
  if (!confirm(t('gestion.task.tags.confirm_delete', { name: tag.name }))) return
  deletingIds.value.add(tag.id)
  try {
    await $fetch(`/api/editions/${props.editionId}/task-groups/${props.groupId}/tags/${tag.id}`, {
      method: 'DELETE',
    })
    localTags.value = localTags.value.filter((t) => t.id !== tag.id)
    emit('saved')
  } catch (e) {
    notifyError(e)
  } finally {
    deletingIds.value.delete(tag.id)
  }
}
</script>
