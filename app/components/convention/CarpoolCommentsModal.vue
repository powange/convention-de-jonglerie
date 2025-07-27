<template>
  <!-- Modal -->
  <UModal v-model="showCommentsModal" title="Commentaires">
    <!-- Bouton déclencheur -->
    <UButton
      size="sm"
      variant="ghost"
      icon="i-heroicons-chat-bubble-left"
      @click="showCommentsModal = true"
    >
      Voir les commentaires ({{ commentCount }})
    </UButton>
    
    <template #body>
        <!-- Chargement -->
      <div v-if="loading" class="text-center py-4">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-2 w-6 h-6" />
        <p>Chargement des commentaires...</p>
      </div>

      <!-- Liste des commentaires -->
      <div v-else-if="comments.length > 0" class="space-y-3 max-h-96 overflow-y-auto">
        <UCard v-for="comment in comments" :key="comment.id" variant="subtle">
        <div class="flex items-center gap-2 mb-2">
          <UAvatar 
            :src="getUserAvatar(comment.user, 24)" 
            :alt="comment.user.pseudo" 
            size="xs"
          />
          <span class="font-medium text-sm">{{ comment.user.pseudo }}</span>
          <span class="text-xs text-gray-500">
            {{ formatRelativeTime(comment.createdAt) }}
          </span>
        </div>
        <p class="text-sm">{{ comment.content }}</p>
      </UCard>
      </div>

      <!-- Aucun commentaire -->
      <div v-else class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-chat-bubble-left" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p class="text-lg font-medium">Aucun commentaire</p>
        <p class="text-sm">Soyez le premier à commenter cette offre !</p>
      </div>

      <!-- Formulaire pour ajouter un commentaire -->
      <div v-if="authStore.isAuthenticated" class="pt-4">
        <UTextarea
          v-model="newComment"
          placeholder="Ajouter un commentaire..."
          autoresize
          class="w-full"
        />
        <div class="flex justify-end">
          <UButton
            :disabled="!newComment.trim()"
            :loading="isAddingComment"
            color="primary"
            @click="addComment"
          >
            Publier
          </UButton>
        </div>
      </div>

      <!-- Message pour utilisateurs non connectés -->
      <div v-else class="pt-4 border-t text-center text-gray-500">
        <p class="text-sm">
          <NuxtLink to="/login" class="text-primary-600 hover:underline">
            Connectez-vous
          </NuxtLink>
          pour ajouter un commentaire
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useAvatar } from '~/utils/avatar';

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    pseudo: string;
    email: string;
  };
}

interface Props {
  offerId: number;
  commentCount?: number;
}

const showCommentsModal = ref(false);

const props = defineProps<Props>();
const emit = defineEmits<{
  'comment-added': [];
}>();

const authStore = useAuthStore();
const toast = useToast();
const { getUserAvatar } = useAvatar();

const loading = ref(false);
const comments = ref<Comment[]>([]);
const newComment = ref('');
const isAddingComment = ref(false);

// Charger les commentaires quand la modal s'ouvre
watch(showCommentsModal, async (open) => {
  if (open) {
    await loadComments();
  }
});

const loadComments = async () => {
  loading.value = true;
  try {
    const response = await $fetch(`/api/carpool-offers/${props.offerId}/comments`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    comments.value = response;
  } catch (error) {
    console.error('Erreur lors du chargement des commentaires:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger les commentaires',
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
};

const formatRelativeTime = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (diffInMinutes < 1) return 'à l\'instant';
  if (diffInMinutes < 60) return `il y a ${diffInMinutes} min`;
  if (diffInMinutes < 1440) return `il y a ${Math.floor(diffInMinutes / 60)} h`;
  return `il y a ${Math.floor(diffInMinutes / 1440)} j`;
};

const addComment = async () => {
  if (!newComment.value.trim()) return;

  isAddingComment.value = true;
  try {
    await $fetch(`/api/carpool-offers/${props.offerId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: {
        content: newComment.value,
      },
    });

    newComment.value = '';
    await loadComments(); // Recharger les commentaires
    emit('comment-added');
    toast.add({
      title: 'Commentaire ajouté',
      color: 'green',
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible d\'ajouter le commentaire',
      color: 'red',
    });
  } finally {
    isAddingComment.value = false;
  }
};
</script>