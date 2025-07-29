<template>
  <UCard variant="subtle">
    <!-- En-tête du post -->
    <template #header>
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <UAvatar
            :src="post.user.profilePicture"
            :alt="post.user.pseudo"
            size="md"
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
        {{ showReplyForm ? 'Annuler' : 'Répondre' }}
      </UButton>
      
      <UButton
        v-if="post.comments.length > 0"
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="showComments ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        @click="showComments = !showComments"
      >
        {{ post.comments.length }} {{ post.comments.length === 1 ? 'réponse' : 'réponses' }}
      </UButton>
    </div>

    <!-- Formulaire de réponse -->
    <div v-if="showReplyForm && authStore.isAuthenticated" class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UForm :state="replyForm" :validate="validateReply" @submit="submitReply">
        <UFormField label="Votre réponse" name="content" required>
          <UTextarea
            v-model="replyForm.content"
            placeholder="Votre réponse..."
            :rows="3"
            :maxlength="1000"
            class="w-full"
          />
          <template #help>
            <div class="flex justify-between text-xs">
              <span>Répondez à ce commentaire</span>
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
            Annuler
          </UButton>
          <UButton 
            type="submit" 
            size="sm"
            :loading="isSubmittingReply"
            :disabled="!replyForm.content.trim()"
          >
            Publier
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
        <UAvatar
          :src="comment.user.profilePicture"
          :alt="comment.user.pseudo"
          size="sm"
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
const validateReply = (state: any) => {
  const errors = [];
  if (!state.content || !state.content.trim()) {
    errors.push({ path: 'content', message: 'Le contenu est requis' });
  }
  if (state.content && state.content.length > 1000) {
    errors.push({ path: 'content', message: 'Le contenu ne peut pas dépasser 1000 caractères' });
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
    return 'À l\'instant';
  } else if (diffInMinutes < 60) {
    return `il y a ${diffInMinutes} min`;
  } else if (diffInHours < 24) {
    return `il y a ${diffInHours}h`;
  } else if (diffInDays < 7) {
    return `il y a ${diffInDays}j`;
  } else {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};
</script>