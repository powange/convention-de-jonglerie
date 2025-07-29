<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3 flex-1">
          <img 
            :src="getUserAvatar(offer.user, 20)" 
            :alt="`Avatar de ${offer.user.pseudo}`"
            class="w-10 h-10 rounded-full"
          >
          <div>
            <p class="font-semibold">{{ offer.user.pseudo }}</p>
            <p class="text-sm text-gray-500">
              Proposé le {{ new Date(offer.createdAt).toLocaleDateString() }}
            </p>
          </div>
        </div>
        
        <!-- Boutons d'action pour le créateur -->
        <div v-if="canEdit" class="flex gap-1">
          <UButton
            icon="i-heroicons-pencil"
            size="xs"
            color="warning"
            variant="ghost"
            title="Modifier l'offre"
            @click="emit('edit')"
          />
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            color="error"
            variant="ghost"
            title="Supprimer l'offre"
            @click="handleDelete"
          />
        </div>
        <div class="text-right">
          <UBadge :color="remainingSeats > 0 ? 'primary' : 'gray'" variant="soft" class="mb-2">
            {{ remainingSeats }} place{{ remainingSeats > 1 ? 's' : '' }} {{ remainingSeats > 0 ? 'disponible' : 'restante' }}{{ remainingSeats > 1 ? 's' : '' }}
          </UBadge>
          <div class="text-sm">
            <div class="flex items-center gap-1 justify-end mb-1">
              <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ formatDate(offer.departureDate) }}</span>
            </div>
            <div class="flex items-center gap-1 justify-end">
              <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ offer.departureCity }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Détails du trajet -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-map" class="text-gray-400" />
          <span class="font-medium">Adresse :</span>
          <span>{{ offer.departureAddress }}</span>
        </div>

        <div v-if="authStore.isAuthenticated && offer.phoneNumber" class="flex items-center gap-2">
          <UIcon name="i-heroicons-phone" class="text-gray-400" />
          <span class="font-medium">Contact :</span>
          <span>{{ offer.phoneNumber }}</span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="offer.description" class="text-sm text-gray-600">{{ offer.description }}</p>

      <!-- Covoitureurs -->
      <div v-if="offer.passengers && offer.passengers.length > 0" class="space-y-2">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Covoitureurs confirmés :</h4>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="passenger in offer.passengers"
            :key="passenger.id"
            class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-sm"
            :title="`Ajouté le ${new Date(passenger.addedAt).toLocaleDateString()}`"
          >
            <img 
              :src="getUserAvatar(passenger.user, 16)" 
              :alt="`Avatar de ${passenger.user.pseudo}`"
              class="w-4 h-4 rounded-full"
            >
            <span class="text-green-700 dark:text-green-300">{{ passenger.user.pseudo }}</span>
            <UButton
              v-if="canEdit"
              icon="i-heroicons-x-mark"
              size="2xs"
              color="error"
              variant="ghost"
              :title="`Retirer ${passenger.user.pseudo}`"
              @click="removePassenger(passenger.user.id)"
            />
          </div>
        </div>
      </div>

      <!-- Section commentaires -->
      <div class="pt-4">
        <div class="flex items-center justify-between">
          <!-- Modal des commentaires -->
          <CarpoolCommentsModal
            :id="offer.id"
            type="offer"
            :offer="offer"
            @comment-added="emit('comment-added')"
            @passenger-added="emit('passenger-added')"
          />
        </div>
      </div>

    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useAvatar } from '~/utils/avatar';
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';

interface CarpoolOffer {
  id: number;
  departureDate: string;
  departureCity: string;
  departureAddress: string;
  availableSeats: number;
  description?: string;
  phoneNumber?: string;
  createdAt: string;
  user: {
    id: number;
    pseudo: string;
    emailHash: string;
    profilePicture?: string | null;
    updatedAt?: string;
  };
  comments?: Array<{
    id: number;
    content: string;
    createdAt: string;
    user: {
      id: number;
      pseudo: string;
      emailHash: string;
      profilePicture?: string | null;
      updatedAt?: string;
    };
  }>;
}

interface Props {
  offer: CarpoolOffer;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'comment-added': [];
  'passenger-added': [];
  'edit': [];
  'deleted': [];
}>();

const authStore = useAuthStore();
const { getUserAvatar } = useAvatar();
const toast = useToast();

// Vérifier si l'utilisateur peut éditer cette offre
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.offer.user.id;
});

// Calculer les places restantes
const remainingSeats = computed(() => {
  const passengers = props.offer.passengers || [];
  return props.offer.availableSeats - passengers.length;
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const handleDelete = async () => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre de covoiturage ?')) {
    return;
  }

  try {
    await $fetch(`/api/carpool-offers/${props.offer.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });

    toast.add({
      title: 'Offre supprimée',
      description: 'Votre offre de covoiturage a été supprimée avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });

    emit('deleted');
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: 'Erreur lors de la suppression',
      description: httpError.data?.message || httpError.message || 'Une erreur est survenue',
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  }
};

const removePassenger = async (userId: number) => {
  if (!confirm('Êtes-vous sûr de vouloir retirer ce covoitureur ?')) {
    return;
  }

  try {
    await $fetch(`/api/carpool-offers/${props.offer.id}/passengers/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });

    toast.add({
      title: 'Covoitureur retiré',
      description: 'Le covoitureur a été retiré avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });

    emit('passenger-added'); // Utiliser le même événement pour rafraîchir
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: 'Erreur lors du retrait',
      description: httpError.data?.message || httpError.message || 'Une erreur est survenue',
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  }
};
</script>