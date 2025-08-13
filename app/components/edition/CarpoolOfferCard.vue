<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3 flex-1">
          <UserAvatar
            :user="offer.user"
            size="lg"
          />
          <div>
            <p class="font-semibold">{{ offer.user.pseudo }}</p>
            <p class="text-sm text-gray-500">
              {{ $t('components.carpool.offered_on', { date: new Date(offer.createdAt).toLocaleDateString() }) }}
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
            :title="$t('components.carpool.edit_offer')"
            @click="emit('edit')"
          />
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            color="error"
            variant="ghost"
            :title="$t('components.carpool.delete_offer')"
            @click="handleDelete"
          />
        </div>
        <div class="text-right">
          <UBadge :color="remainingSeats > 0 ? 'primary' : 'neutral'" variant="soft" class="mb-2">
            {{ $t('components.carpool.seats_available', { count: remainingSeats }) }}
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
          <span class="font-medium">{{ $t('components.carpool.address') }} :</span>
          <span>{{ offer.departureAddress }}</span>
        </div>

        <div v-if="authStore.isAuthenticated && offer.phoneNumber" class="flex items-center gap-2">
          <UIcon name="i-heroicons-phone" class="text-gray-400" />
          <span class="font-medium">{{ $t('components.carpool.contact') }} :</span>
          <span>{{ offer.phoneNumber }}</span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="offer.description" class="text-sm text-gray-600">{{ offer.description }}</p>

      <!-- Covoitureurs -->
      <div v-if="offer.passengers && offer.passengers.length > 0" class="space-y-2">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('components.carpool.confirmed_passengers') }} :</h4>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="passenger in offer.passengers"
            :key="passenger.id"
            class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-sm"
            :title="$t('components.carpool.added_on', { date: new Date(passenger.addedAt).toLocaleDateString() })"
          >
            <UserAvatar
              :user="passenger.user"
              size="xs"
            />
            <span class="text-green-700 dark:text-green-300">{{ passenger.user.pseudo }}</span>
            <UButton
              v-if="canEdit"
              icon="i-heroicons-x-mark"
              size="2xs"
              color="error"
              variant="ghost"
              :title="$t('components.carpool.remove_passenger', { name: passenger.user.pseudo })"
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
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';
import UserAvatar from '~/components/ui/UserAvatar.vue';

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
const toast = useToast();
const { t } = useI18n();

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
  const { locale } = useI18n();
  return new Date(date).toLocaleString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const handleDelete = async () => {
  if (!confirm(t('components.carpool.confirm_delete_offer'))) {
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
      title: t('messages.offer_deleted'),
      description: t('messages.offer_deleted_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    });

    emit('deleted');
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: t('errors.deletion_error'),
      description: httpError.data?.message || httpError.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    });
  }
};

const removePassenger = async (userId: number) => {
  if (!confirm(t('components.carpool.confirm_remove_passenger'))) {
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
      title: t('messages.passenger_removed'),
      description: t('messages.passenger_removed_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    });

    emit('passenger-added'); // Utiliser le même événement pour rafraîchir
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: t('errors.removal_error'),
      description: httpError.data?.message || httpError.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    });
  }
};
</script>