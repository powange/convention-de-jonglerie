<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold flex items-center gap-2">
      <UIcon name="i-heroicons-chat-bubble-left" />
      {{ $t('components.carpool.comments') }}
      <UBadge v-if="comments.length > 0" color="neutral" variant="soft" size="sm">
        {{ comments.length }}
      </UBadge>
    </h3>

    <!-- Chargement -->
    <div v-if="loading" class="text-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-2 w-6 h-6" />
      <p>{{ $t('components.carpool.loading_comments') }}</p>
    </div>

    <!-- Liste des commentaires -->
    <div v-else-if="comments.length > 0" class="space-y-3">
      <UCard v-for="comment in comments" :key="comment.id" variant="subtle">
        <div class="mb-2">
          <UiUserDisplay :user="comment.user" :datetime="comment.createdAt" size="sm" />
        </div>
        <p class="text-sm">{{ comment.content }}</p>
      </UCard>
    </div>

    <!-- Aucun commentaire -->
    <div v-else class="text-center py-6 text-gray-500">
      <UIcon name="i-heroicons-chat-bubble-left" class="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p class="font-medium">{{ $t('components.carpool.no_comments') }}</p>
      <p class="text-sm">
        {{
          $t('components.carpool.be_first_to_comment', { type: $t(`components.carpool.${type}`) })
        }}
      </p>
    </div>

    <!-- Formulaire pour ajouter un commentaire -->
    <div
      v-if="authStore.isAuthenticated"
      class="pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <UTextarea
        v-model="newComment"
        :placeholder="$t('components.carpool.add_comment_placeholder')"
        autoresize
        class="w-full"
        @blur="newComment = newComment.trim()"
      />
      <div class="flex justify-end mt-2">
        <UButton
          :disabled="!newComment.trim()"
          :loading="isAddingComment"
          color="primary"
          @click="addComment"
        >
          {{ $t('components.carpool.publish') }}
        </UButton>
      </div>
    </div>

    <!-- Message pour utilisateurs non connectés -->
    <div
      v-else
      class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500"
    >
      <p class="text-sm">
        <NuxtLink
          :to="useReturnTo().buildLoginUrl($route.fullPath)"
          class="text-primary-600 hover:underline"
        >
          {{ $t('auth.login') }}
        </NuxtLink>
        {{ $t('components.carpool.to_add_comment') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

interface Comment {
  id: number
  content: string
  createdAt: string
  user: {
    id: number
    pseudo: string
    email: string
  }
}

interface Props {
  id: number
  type: 'offer' | 'request'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'comment-added': []
}>()

const authStore = useAuthStore()
const { t } = useI18n()

const comments = ref<Comment[]>([])
const newComment = ref('')

const { execute: loadComments, loading } = useApiAction(
  () =>
    props.type === 'offer'
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`,
  {
    method: 'GET',
    errorMessages: { default: t('errors.cannot_load_comments') },
    onSuccess: (response: any) => {
      comments.value = response
    },
  }
)

const { execute: executeAddComment, loading: isAddingComment } = useApiAction(
  () =>
    props.type === 'offer'
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`,
  {
    method: 'POST',
    body: () => ({ content: newComment.value }),
    successMessage: { title: t('messages.comment_added') },
    errorMessages: { default: t('errors.cannot_add_comment') },
    onSuccess: async () => {
      newComment.value = ''
      await loadComments()
      emit('comment-added')
    },
  }
)

onMounted(async () => {
  await loadComments()
})

const addComment = () => {
  newComment.value = newComment.value.trim()
  if (!newComment.value) return
  executeAddComment()
}
</script>
