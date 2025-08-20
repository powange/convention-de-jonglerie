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

      <!-- Ma réservation (pour l'utilisateur connecté non propriétaire) -->
      <div v-if="authStore.isAuthenticated && !canEdit && myBooking" class="border rounded p-3 bg-gray-50 dark:bg-gray-900/30">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-ticket" class="text-primary-500" />
            <span class="font-medium">{{ $t('components.carpool.my_booking') }}</span>
          </div>
          <UBadge :color="myBooking.status === 'ACCEPTED' ? 'success' : myBooking.status === 'REJECTED' ? 'error' : myBooking.status === 'CANCELLED' ? 'neutral' : 'warning'" variant="soft">{{ myBooking.status }}</UBadge>
        </div>
        <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
          {{ $t('components.carpool.requested_seats', { count: myBooking.seats }) }}
        </div>
        <div v-if="myBooking.status === 'PENDING' || myBooking.status === 'ACCEPTED'" class="mt-2 text-right">
          <UButton size="xs" color="error" variant="soft" :loading="isCancelling" @click="cancelMyBooking">{{ $t('common.cancel') }}</UButton>
        </div>
      </div>

      <!-- Réservations acceptées -->
      <div v-if="acceptedBookings.length > 0" class="space-y-2">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('components.carpool.confirmed_passengers') }} :</h4>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="b in acceptedBookings"
            :key="b.id"
            class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-sm"
            :title="$t('components.carpool.added_on', { date: new Date(b.createdAt).toLocaleDateString() })"
          >
            <UserAvatar
              :user="b.requester"
              size="xs"
            />
            <span class="text-green-700 dark:text-green-300">{{ b.requester.pseudo }}</span>
            <UBadge color="success" variant="soft">+{{ b.seats }}</UBadge>
          </div>
        </div>
      </div>

      <!-- Section commentaires -->
      <div class="pt-4">
        <div class="flex items-center justify-between">
          <div v-if="authStore.isAuthenticated" class="flex gap-2">
            <UButton
              :disabled="remainingSeats <= 0"
              color="primary"
              icon="i-heroicons-ticket"
              size="sm"
              @click="showBookingModal = true"
            >
              {{ $t('components.carpool.book_seats') }}
            </UButton>
          </div>
          <!-- Modal des commentaires -->
          <CarpoolCommentsModal
            :id="offer.id"
            type="offer"
            @comment-added="emit('comment-added')"
          />
        </div>
      </div>

      <!-- Réservations en attente (visible au propriétaire) -->
      <div v-if="canEdit" class="pt-2">
        <CarpoolBookingsList :offer-id="offer.id" @updated="emit('passenger-added')" />
      </div>

      <!-- Modal de réservation -->
      <UModal v-model:open="showBookingModal" :title="$t('components.carpool.book_seats')">
        <template #body>
          <div class="space-y-4">
            <UFormField :label="$t('components.carpool.how_many_seats_needed')">
              <div class="flex gap-2">
                <UButton
                  v-for="n in Math.min(8, Math.max(1, remainingSeats))"
                  :key="n"
                  :color="bookingSeats === n ? 'primary' : 'neutral'"
                  :variant="bookingSeats === n ? 'solid' : 'outline'"
                  size="sm"
                  @click="bookingSeats = n"
                >
                  <UIcon name="i-heroicons-user" />
                  {{ n }}
                </UButton>
              </div>
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="showBookingModal = false">{{ $t('forms.buttons.cancel') }}</UButton>
              <UButton color="primary" :disabled="isBooking || bookingSeats < 1" @click="submitBooking">{{ isBooking ? $t('forms.buttons.submitting') : $t('components.carpool.confirm_booking') }}</UButton>
            </div>
          </div>
        </template>
      </UModal>

    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';
import CarpoolBookingsList from './CarpoolBookingsList.vue';
import UserAvatar from '~/components/ui/UserAvatar.vue';

interface CarpoolOffer {
  id: number;
  departureDate: string;
  departureCity: string;
  departureAddress: string;
  availableSeats: number;
  remainingSeats?: number;
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
  bookings?: Array<{
    id: number;
    seats: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
    createdAt: string;
    requester: {
      id: number;
      pseudo: string;
      emailHash: string;
      profilePicture?: string | null;
      updatedAt?: string;
    };
  }>;
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

// Calculer les places restantes: si fourni par l'API via bookings ACCEPTED, sinon fallback sur passagers
const remainingSeats = computed(() => {
  if (typeof props.offer.remainingSeats === 'number') return props.offer.remainingSeats;
  const bookings = props.offer.bookings || [];
  const accepted = bookings.filter(b => b.status === 'ACCEPTED').reduce((s, b) => s + (b.seats || 0), 0);
  return Math.max(0, props.offer.availableSeats - accepted);
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
    });

    toast.add({
      title: t('messages.offer_deleted'),
      description: t('messages.offer_deleted_successfully'),
      icon: 'i-heroicons-check-circle',
  color: 'success'
    });

    emit('deleted');
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: t('errors.deletion_error'),
      description: httpError.data?.message || httpError.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  }
};

const acceptedBookings = computed(() => (props.offer.bookings || []).filter(b => b.status === 'ACCEPTED'));

// Ma réservation sur cette offre (dernier en date si plusieurs)
const myBookings = ref<Array<{ id: number; seats: number; status: string; createdAt: string }>>([]);
const myBooking = computed(() => {
  if (!myBookings.value.length) return null as any;
  return [...myBookings.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
});

const loadMyBookings = async () => {
  if (!authStore.isAuthenticated || canEdit.value) return; // pas pour le propriétaire
  try {
    const data = await $fetch(`/api/carpool-offers/${props.offer.id}/bookings`);
    // L'API renvoie déjà seulement mes réservations si je ne suis pas propriétaire
    myBookings.value = Array.isArray(data) ? data : [];
  } catch {
    // silencieux
  }
};

onMounted(loadMyBookings);
watch(() => authStore.isAuthenticated, () => loadMyBookings());

// Réservation
const showBookingModal = ref(false);
const bookingSeats = ref(1);
const isBooking = ref(false);

const submitBooking = async () => {
  if (bookingSeats.value < 1) return;
  try {
    isBooking.value = true;
    await $fetch(`/api/carpool-offers/${props.offer.id}/bookings`, {
      method: 'POST',
      body: { seats: bookingSeats.value }
    } as any);
    toast.add({
      title: t('messages.booking_requested'),
      description: t('messages.booking_requested_successfully'),
      color: 'success',
      icon: 'i-heroicons-check-circle'
    });
    showBookingModal.value = false;
  await loadMyBookings();
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: t('common.error'),
      description: httpError.data?.message || httpError.message || t('errors.generic_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    });
  } finally {
    isBooking.value = false;
  }
};

const isCancelling = ref(false);
const cancelMyBooking = async () => {
  if (!myBooking.value) return;
  try {
    isCancelling.value = true;
    await $fetch(`/api/carpool-offers/${props.offer.id}/bookings/${myBooking.value.id}`, { method: 'PUT', body: { action: 'CANCEL' } } as any);
    await loadMyBookings();
    toast.add({ title: t('messages.booking_cancelled') || t('common.cancelled') || 'Réservation annulée', color: 'success' });
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({ title: t('common.error'), description: httpError.data?.message || httpError.message || t('errors.generic_error'), color: 'error' });
  } finally {
    isCancelling.value = false;
  }
};
</script>