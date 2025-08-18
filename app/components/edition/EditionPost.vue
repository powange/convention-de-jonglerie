<template>
  <UCard variant="subtle">
    <!-- En-tête du post -->
    <template #header>
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <UserAvatar 
            :user="post.user" 
            size="lg"
          />
          <div>
            <p class="font-medium text-gray-900 dark:text-gray-100">
              {{ post.user.pseudo }}
            </p>
            <p class="text-sm text-gray-500">
              {{ formatDate(post.createdAt) }}
            </p>
          </div>
        </div>
        
        <!-- Menu d'actions -->
        <UButton
          v-if="canDeletePost"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="sm"
          @click="deletePost"
        />
      </div>
    </template>

    <!-- Contenu du post -->
    <div class="mb-4">
      <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ post.content }}</p>
    </div>

    <!-- Actions du post -->
    <div class="flex items-center gap-4 py-2 border-t border-gray-200 dark:border-gray-700">
      <UButton
        v-if="authStore.isAuthenticated"
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="showReplyForm ? 'i-heroicons-x-mark' : 'i-heroicons-chat-bubble-left'"
        @click="toggleReplyForm"
      >
        {{ showReplyForm ? $t('common.cancel') : $t('components.posts.reply') }}
      </UButton>
      
      <UButton
        v-if="post.comments.length > 0"
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="showComments ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        @click="showComments = !showComments"
      >
        {{ $t('components.posts.replies_count', { count: post.comments.length }) }}
      </UButton>
    </div>

    <!-- Formulaire de réponse -->
    <div v-if="showReplyForm && authStore.isAuthenticated" class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UForm :state="replyForm" :validate="validateReply" @submit="submitReply">
        <UFormField :label="$t('components.posts.your_reply')" name="content" required>
          <UTextarea
            v-model="replyForm.content"
            :placeholder="$t('components.posts.your_reply_placeholder')"
            :rows="3"
            :maxlength="1000"
            class="w-full"
          />
          <template #help>
            <div class="flex justify-between text-xs">
              <span>{{ $t('components.posts.reply_to_comment') }}</span>
              <span :class="replyForm.content.length > 900 ? 'text-warning-500' : 'text-gray-500'">
                {{ replyForm.content.length }}/1000
              </span>
            </div>
          </template>
        </UFormField>
        
        <div class="flex justify-end gap-2 mt-3">
          <UButton 
            type="button" 
            color="neutral" 
            variant="ghost"
            size="sm"
            @click="toggleReplyForm"
          >
            {{ $t('common.cancel') }}
          </UButton>
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

    <!-- Liste des commentaires -->
    <div v-if="post.comments.length > 0 && showComments" class="mt-4 space-y-3">
      <div
        v-for="comment in post.comments"
        :key="comment.id"
        class="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <UserAvatar 
          :user="comment.user" 
          size="md" 
          shrink
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ comment.user.pseudo }}
              </p>
              <span class="text-xs text-gray-500">•</span>
              <span class="text-xs text-gray-500">{{ formatDate(comment.createdAt) }}</span>
            </div>
            
            <!-- Menu d'actions pour le commentaire -->
            <UButton
              v-if="canDeleteComment(comment)"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-trash"
              size="xs"
              @click="deleteComment(comment.id)"
            />
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
            {{ comment.content }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useAuthStore } from '~/stores/auth';
import UserAvatar from '~/components/ui/UserAvatar.vue';

const { t } = useI18n();

interface User {
  id: number;
  pseudo: string;
  profilePicture?: string;
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  user: User;
}

interface Post {
  id: number;
  content: string;
  createdAt: string;
  user: User;
  comments: Comment[];
}

interface Props {
  post: Post;
  currentUserId?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'delete-post': [postId: number];
  'add-comment': [postId: number, content: string];
  'delete-comment': [postId: number, commentId: number];
}>();

const authStore = useAuthStore();

const showReplyForm = ref(false);
const showComments = ref(false);
const isSubmittingReply = ref(false);

const replyForm = reactive({
  content: ''
});

// Vérifier si l'utilisateur peut supprimer le post
const canDeletePost = computed(() => {
  return props.currentUserId === props.post.user.id;
});

// Vérifier si l'utilisateur peut supprimer un commentaire
const canDeleteComment = (comment: Comment) => {
  return props.currentUserId === comment.user.id;
};


// Validation de la réponse
interface ReplyFormState { content: string }
const validateReply = (state: ReplyFormState) => {
  const errors: { path: string; message: string }[] = [];
  if (!state.content || !state.content.trim()) {
    errors.push({ path: 'content', message: t('errors.content_required') });
  }
  if (state.content && state.content.length > 1000) {
    errors.push({ path: 'content', message: t('errors.content_too_long', { max: 1000 }) });
  }
  return errors;
};

// Basculer le formulaire de réponse
const toggleReplyForm = () => {
  showReplyForm.value = !showReplyForm.value;
  if (!showReplyForm.value) {
    replyForm.content = '';
  }
};

// Soumettre une réponse
const submitReply = async () => {
  isSubmittingReply.value = true;
  try {
    await emit('add-comment', props.post.id, replyForm.content.trim());
    replyForm.content = '';
    showReplyForm.value = false;
    showComments.value = true; // Ouvrir les commentaires pour voir la nouvelle réponse
  } finally {
    isSubmittingReply.value = false;
  }
};

// Supprimer le post
const deletePost = () => {
  emit('delete-post', props.post.id);
};

// Supprimer un commentaire
const deleteComment = (commentId: number) => {
  emit('delete-comment', props.post.id, commentId);
};

// Formater la date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return t('common.time_just_now');
  } else if (diffInMinutes < 60) {
    return t('common.time_minutes_ago', { count: diffInMinutes });
  } else if (diffInHours < 24) {
    return t('common.time_hours_ago', { count: diffInHours });
  } else if (diffInDays < 7) {
    return t('common.time_days_ago', { count: diffInDays });
  } else {
    const { locale } = useI18n();
    return date.toLocaleDateString(locale.value, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};
</script>