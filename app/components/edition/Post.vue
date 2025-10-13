<template>
  <UCard variant="subtle">
    <!-- En-tête du post -->
    <template #header>
      <div class="flex items-start justify-between">
        <UiUserDisplay :user="post.user" :datetime="post.createdAt" size="lg" />

        <!-- Menu d'actions et badge -->
        <div class="flex items-center gap-2">
          <!-- Badge épinglé -->
          <UBadge v-if="post.pinned" color="primary" variant="subtle" size="sm">
            <div class="flex items-center gap-1">
              <UIcon name="i-heroicons-bookmark-solid" />
              <span>{{ $t('components.posts.pinned') }}</span>
            </div>
          </UBadge>

          <!-- Boutons d'action -->
          <UButton
            v-if="canPin"
            color="neutral"
            variant="ghost"
            :icon="post.pinned ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
            size="sm"
            @click="togglePin"
          />
          <UButton
            v-if="canDeletePost"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-trash"
            size="sm"
            @click="deletePost"
          />
        </div>
      </div>
    </template>

    <!-- Contenu du post -->
    <div class="mb-4">
      <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ post.content }}</p>
    </div>

    <!-- Actions du post -->
    <div class="flex items-center gap-4 py-2 border-t border-gray-200 dark:border-gray-700">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="showComments ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        @click="showComments = !showComments"
      >
        {{ $t('components.posts.comments_count', { count: post.comments.length }) }}
      </UButton>
    </div>

    <!-- Liste des commentaires -->
    <div v-if="post.comments.length > 0 && showComments" class="mt-4 ml-8 space-y-2">
      <UChatMessage
        v-for="comment in post.comments"
        :id="String(comment.id)"
        :key="comment.id"
        role="user"
        :parts="[{ type: 'text', text: comment.content }]"
        :avatar="{
          src: comment.user.profilePicture,
          alt: comment.user.pseudo,
        }"
        variant="soft"
        side="left"
        :actions="
          canDeleteComment(comment)
            ? [
                {
                  icon: 'i-heroicons-trash',
                  color: 'error',
                  onClick: () => deleteComment(comment.id),
                },
              ]
            : undefined
        "
      >
        <template #leading>
          <div class="flex flex-col items-start">
            <UiUserAvatar
              :user="{
                id: comment.user.id,
                pseudo: comment.user.pseudo,
                profilePicture: comment.user.profilePicture,
                emailHash: comment.user.emailHash,
              }"
              size="md"
            />
            <span class="text-xs font-medium mt-1">{{ comment.user.pseudo }}</span>
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-1">
            <p class="whitespace-pre-wrap">{{ comment.content }}</p>
            <span class="text-[10px] text-gray-400 dark:text-gray-500 opacity-70">{{
              formatDateTime(comment.createdAt)
            }}</span>
          </div>
        </template>
      </UChatMessage>
    </div>

    <!-- Formulaire de commentaire -->
    <div
      v-if="showComments && authStore.isAuthenticated"
      class="mt-4 ml-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <UForm :state="replyForm" :validate="validateReply" @submit="submitReply">
        <UFormField :label="$t('components.posts.your_comment')" name="content" required>
          <UTextarea
            v-model="replyForm.content"
            :placeholder="$t('components.posts.your_comment_placeholder')"
            :rows="1"
            :maxlength="1000"
            autoresize
            class="w-full"
          />
          <template #help>
            <div class="flex justify-between text-xs">
              <span>{{ $t('components.posts.reply_to_post') }}</span>
              <span :class="replyForm.content.length > 900 ? 'text-warning-500' : 'text-gray-500'">
                {{ replyForm.content.length }}/1000
              </span>
            </div>
          </template>
        </UFormField>

        <div class="flex justify-end mt-3">
          <UButton
            type="submit"
            size="sm"
            :loading="isSubmittingReply"
            :disabled="!replyForm.content.trim()"
          >
            {{ $t('components.posts.publish') }}
          </UButton>
        </div>
      </UForm>
    </div>
  </UCard>

  <!-- Modal de confirmation pour suppression de post -->
  <UiConfirmModal
    v-model="showDeletePostModal"
    :title="$t('components.posts.confirm_delete_title')"
    :description="$t('components.posts.confirm_delete_post')"
    :confirm-label="$t('common.delete')"
    :cancel-label="$t('common.cancel')"
    confirm-color="error"
    icon-name="i-heroicons-trash"
    icon-color="text-red-500"
    @confirm="confirmDeletePost"
    @cancel="showDeletePostModal = false"
  />

  <!-- Modal de confirmation pour suppression de commentaire -->
  <UiConfirmModal
    v-model="showDeleteCommentModal"
    :title="$t('components.posts.confirm_delete_title')"
    :description="$t('components.posts.confirm_delete_comment')"
    :confirm-label="$t('common.delete')"
    :cancel-label="$t('common.cancel')"
    confirm-color="error"
    icon-name="i-heroicons-trash"
    icon-color="text-red-500"
    @confirm="confirmDeleteComment"
    @cancel="showDeleteCommentModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

import { useAuthStore } from '~/stores/auth'

const { t } = useI18n()

interface User {
  id: number
  pseudo: string
  profilePicture?: string
}

interface Comment {
  id: number
  content: string
  createdAt: string
  user: User
}

interface Post {
  id: number
  content: string
  createdAt: string
  user: User
  comments: Comment[]
  pinned: boolean
}

interface Props {
  post: Post
  currentUserId?: number
  canPin?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'delete-post': [postId: number]
  'add-comment': [postId: number, content: string]
  'delete-comment': [postId: number, commentId: number]
  'toggle-pin': [postId: number, currentPinned: boolean]
}>()

const authStore = useAuthStore()
const { formatDateTime } = useDateFormat()

const showComments = ref(false)
const isSubmittingReply = ref(false)

const replyForm = reactive({
  content: '',
})

// Vérifier si l'utilisateur peut supprimer le post
const canDeletePost = computed(() => {
  return props.currentUserId === props.post.user.id
})

// Vérifier si l'utilisateur peut supprimer un commentaire
const canDeleteComment = (comment: Comment) => {
  return props.currentUserId === comment.user.id
}

// Validation de la réponse
interface ReplyFormState {
  content: string
}
const validateReply = (state: ReplyFormState) => {
  const errors: { path: string; message: string }[] = []
  if (!state.content || !state.content.trim()) {
    errors.push({ path: 'content', message: t('errors.content_required') })
  }
  if (state.content && state.content.length > 1000) {
    errors.push({ path: 'content', message: t('errors.content_too_long', { max: 1000 }) })
  }
  return errors
}

// Soumettre une réponse
const submitReply = async () => {
  isSubmittingReply.value = true
  try {
    await emit('add-comment', props.post.id, replyForm.content.trim())
    replyForm.content = ''
    showComments.value = true // Garder les commentaires ouverts pour voir le nouveau commentaire
  } finally {
    isSubmittingReply.value = false
  }
}

// Modal de confirmation pour suppression
const showDeletePostModal = ref(false)
const showDeleteCommentModal = ref(false)
const commentToDelete = ref<number | null>(null)

// Supprimer le post
const deletePost = () => {
  showDeletePostModal.value = true
}

const confirmDeletePost = () => {
  emit('delete-post', props.post.id)
  showDeletePostModal.value = false
}

// Supprimer un commentaire
const deleteComment = (commentId: number) => {
  commentToDelete.value = commentId
  showDeleteCommentModal.value = true
}

const confirmDeleteComment = () => {
  if (commentToDelete.value) {
    emit('delete-comment', props.post.id, commentToDelete.value)
  }
  showDeleteCommentModal.value = false
  commentToDelete.value = null
}

// Épingler/désépingler le post
const togglePin = () => {
  emit('toggle-pin', props.post.id, props.post.pinned)
}
</script>
