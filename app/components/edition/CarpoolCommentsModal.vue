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
      Voir les commentaires ({{ comments.length }})
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
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <UserAvatar
              :user="comment.user"
              size="sm"
              class="w-5 h-5"
            />
            <span class="font-medium text-sm">{{ comment.user.pseudo }}</span>
            <span class="text-xs text-gray-500">
              {{ formatRelativeTime(comment.createdAt) }}
            </span>
          </div>
          
          <!-- Bouton pour ajouter comme covoitureur (uniquement pour les offres et si l'utilisateur est le créateur) -->
          <UButton
            v-if="type === 'offer' && canAddPassenger(comment.user.id)"
            size="xs"
            color="primary"
            variant="ghost"
            icon="i-heroicons-plus"
            :loading="addingPassenger === comment.user.id"
            @click="addPassenger(comment.user.id)"
            title="Ajouter comme covoitureur"
          />
        </div>
        <p class="text-sm">{{ comment.content }}</p>
      </UCard>
      </div>

      <!-- Aucun commentaire -->
      <div v-else class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-chat-bubble-left" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p class="text-lg font-medium">Aucun commentaire</p>
        <p class="text-sm">Soyez le premier à commenter cette {{ type === 'offer' ? 'offre' : 'demande' }} !</p>
      </div>

      <!-- Formulaire pour ajouter un commentaire -->
      <div v-if="authStore.isAuthenticated" class="pt-4">
        <UTextarea
          v-model="newComment"
          placeholder="Ajouter un commentaire..."
          autoresize
          class="w-full"
          @blur="newComment = newComment.trim()"
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
          <NuxtLink :to="`/login?returnTo=${encodeURIComponent($route.fullPath)}`" class="text-primary-600 hover:underline">
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
  id: number;
  type: 'offer' | 'request';
  offer?: any; // Pour accéder aux informations de l'offre (créateur, passagers, etc.)
}

const showCommentsModal = ref(false);

const props = defineProps<Props>();
const emit = defineEmits<{
  'comment-added': [];
  'passenger-added': [];
}>();

const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);
const comments = ref<Comment[]>([]);
const newComment = ref('');
const isAddingComment = ref(false);
const addingPassenger = ref<number | null>(null);

// Charger le nombre de commentaires au montage
onMounted(async () => {
  await loadComments();
});

// Charger les commentaires quand la modal s'ouvre
watch(showCommentsModal, async (open) => {
  if (open) {
    await loadComments();
  }
});

const loadComments = async () => {
  loading.value = true;
  try {
    const endpoint = props.type === 'offer' 
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`;
    
    const response = await $fetch(endpoint, {
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
  // Nettoyer le commentaire et vérifier qu'il n'est pas vide
  newComment.value = newComment.value.trim();
  if (!newComment.value) return;

  isAddingComment.value = true;
  try {
    const endpoint = props.type === 'offer' 
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`;
    
    await $fetch(endpoint, {
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

// Vérifier si l'utilisateur peut être ajouté comme passager
const canAddPassenger = (userId: number) => {
  if (!props.offer || !authStore.user) return false;
  
  // Seulement le créateur de l'offre peut ajouter des passagers
  if (props.offer.user.id !== authStore.user.id) return false;
  
  // L'utilisateur ne peut pas s'ajouter lui-même
  if (userId === authStore.user.id) return false;
  
  // Vérifier que l'utilisateur n'est pas déjà passager
  const isAlreadyPassenger = props.offer.passengers?.some((p: any) => p.user.id === userId);
  if (isAlreadyPassenger) return false;
  
  // Vérifier qu'il reste des places
  const currentPassengers = props.offer.passengers?.length || 0;
  return currentPassengers < props.offer.availableSeats;
};

// Ajouter un passager
const addPassenger = async (userId: number) => {
  if (!canAddPassenger(userId)) return;
  
  addingPassenger.value = userId;
  try {
    await $fetch(`/api/carpool-offers/${props.id}/passengers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: {
        userId: userId,
      },
    });

    emit('passenger-added');
    toast.add({
      title: 'Covoitureur ajouté',
      description: 'L\'utilisateur a été ajouté comme covoitureur',
      color: 'green',
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'ajout du covoitureur:', error);
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible d\'ajouter le covoitureur',
      color: 'red',
    });
  } finally {
    addingPassenger.value = null;
  }
};
</script>