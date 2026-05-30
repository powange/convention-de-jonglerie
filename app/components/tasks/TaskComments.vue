<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UIcon name="i-heroicons-chat-bubble-left-right" class="size-5 text-gray-500" />
      <h3 class="text-sm font-semibold">
        {{ $t('gestion.tasks.comments.title') }}
        <span v-if="comments.length" class="text-gray-400 font-normal"
          >({{ comments.length }})</span
        >
      </h3>
    </div>

    <div v-if="loading" class="flex justify-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-5 text-gray-400" />
    </div>

    <div v-else-if="!comments.length" class="text-sm text-gray-500 italic py-2">
      {{ $t('gestion.tasks.comments.empty') }}
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="c in comments"
        :key="c.id"
        class="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40"
      >
        <UiUserAvatar :user="c.user" size="sm" class="shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="flex items-baseline gap-2 min-w-0">
              <span class="font-medium text-sm truncate">{{ c.user.pseudo }}</span>
              <span class="text-xs text-gray-500 shrink-0">{{ formatDate(c.createdAt) }}</span>
              <UBadge
                v-if="c.editedAt"
                color="neutral"
                variant="soft"
                size="xs"
                :title="formatDate(c.editedAt)"
              >
                {{ $t('gestion.tasks.comments.edited') }}
              </UBadge>
            </div>
            <UDropdownMenu v-if="canManage(c)" :items="getActions(c)">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>

          <!-- Édition inline -->
          <div v-if="editingId === c.id" class="space-y-2">
            <MarkdownEditor
              v-model="editingContent"
              :placeholder="$t('gestion.tasks.comments.placeholder')"
              class="min-h-24"
            />
            <div class="flex gap-2">
              <UButton size="xs" color="primary" :loading="saving" @click="saveEdit(c)">
                {{ $t('common.save') }}
              </UButton>
              <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit">
                {{ $t('common.cancel') }}
              </UButton>
            </div>
          </div>

          <!-- Rendu HTML du markdown (sanitisé via rehype-sanitize dans markdownToHtml) -->
          <div v-else class="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-html="c.renderedHtml" />
          </div>
        </div>
      </li>
    </ul>

    <!-- Formulaire d'ajout -->
    <div v-if="canPost" class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
      <MarkdownEditor
        v-model="newContent"
        :placeholder="$t('gestion.tasks.comments.placeholder')"
        class="min-h-20"
      />
      <div class="flex justify-end">
        <UButton
          color="primary"
          size="sm"
          icon="i-heroicons-paper-airplane"
          :loading="posting"
          :disabled="!newContent.trim()"
          @click="postComment"
        >
          {{ $t('gestion.tasks.comments.post') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { markdownToHtml } from '~/utils/markdown'

interface CommentUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
}
interface TaskCommentItem {
  id: number
  content: string
  editedAt: string | null
  createdAt: string
  user: CommentUser
  renderedHtml?: string
}

const props = defineProps<{
  editionId: number
  taskId: number
  canPost: boolean
  canModerate: boolean
}>()

const { t, locale } = useI18n()
const authStore = useAuthStore()

const comments = ref<TaskCommentItem[]>([])
const loading = ref(false)
const newContent = ref('')
const posting = ref(false)
const editingId = ref<number | null>(null)
const editingContent = ref('')
const saving = ref(false)

async function renderAll(list: TaskCommentItem[]) {
  for (const c of list) {
    c.renderedHtml = await markdownToHtml(c.content)
  }
}

async function fetchComments() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { comments: TaskCommentItem[] } }>(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/comments`
    )
    const list = res?.data?.comments || []
    await renderAll(list)
    comments.value = list
  } finally {
    loading.value = false
  }
}

watch(
  () => props.taskId,
  (id) => {
    if (id) fetchComments()
  },
  { immediate: true }
)

async function postComment() {
  const content = newContent.value.trim()
  if (!content) return
  posting.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { comment: TaskCommentItem } }>(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/comments`,
      { method: 'POST', body: { content } }
    )
    const comment = res?.data?.comment
    if (comment) {
      comment.renderedHtml = await markdownToHtml(comment.content)
      comments.value.push(comment)
    }
    newContent.value = ''
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    posting.value = false
  }
}

function canManage(c: TaskCommentItem): boolean {
  const isAuthor = c.user.id === authStore.user?.id
  return isAuthor || props.canModerate
}

function getActions(c: TaskCommentItem) {
  const isAuthor = c.user.id === authStore.user?.id
  const items: any[] = []
  if (isAuthor) {
    items.push({
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => startEdit(c),
    })
  }
  items.push({
    label: t('common.delete'),
    icon: 'i-heroicons-trash',
    color: 'error' as const,
    onSelect: () => deleteComment(c),
  })
  return [items]
}

function startEdit(c: TaskCommentItem) {
  editingId.value = c.id
  editingContent.value = c.content
}

function cancelEdit() {
  editingId.value = null
  editingContent.value = ''
}

async function saveEdit(c: TaskCommentItem) {
  const content = editingContent.value.trim()
  if (!content) return
  saving.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { comment: TaskCommentItem } }>(
      `/api/editions/${props.editionId}/tasks/${props.taskId}/comments/${c.id}`,
      { method: 'PUT', body: { content } }
    )
    const updated = res?.data?.comment
    if (updated) {
      updated.renderedHtml = await markdownToHtml(updated.content)
      const idx = comments.value.findIndex((x) => x.id === c.id)
      if (idx !== -1) comments.value[idx] = updated
    }
    cancelEdit()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

async function deleteComment(c: TaskCommentItem) {
  if (!confirm(t('gestion.tasks.comments.confirm_delete'))) return
  try {
    await $fetch(`/api/editions/${props.editionId}/tasks/${props.taskId}/comments/${c.id}`, {
      method: 'DELETE',
    })
    comments.value = comments.value.filter((x) => x.id !== c.id)
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
</script>
