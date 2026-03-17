<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <UCard>
      <div class="space-y-4">
        <!-- Utilisateur + actions -->
        <div class="flex items-start justify-between">
          <UiUserDisplay :user="offer.user" :datetime="offer.createdAt" size="lg" />
          <div v-if="canEdit" class="flex gap-1">
            <UButton
              icon="i-heroicons-pencil"
              size="sm"
              color="warning"
              variant="ghost"
              :title="$t('components.carpool.edit_offer')"
              @click="emit('edit')"
            />
            <UButton
              icon="i-heroicons-trash"
              size="sm"
              color="error"
              variant="ghost"
              :title="$t('components.carpool.delete_offer')"
              @click="handleDelete"
            />
          </div>
        </div>

        <!-- Infos du trajet -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar" class="text-gray-400 size-5" />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.trip_date') }}</p>
              <p class="font-medium">{{ formatTripDate(offer.tripDate) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-map-pin" class="text-gray-400 size-5" />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.location') }}</p>
              <p class="font-medium">{{ offer.locationCity }}</p>
              <p v-if="offer.locationAddress" class="text-sm text-gray-500">
                {{ offer.locationAddress }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon
              :name="
                offer.direction === 'TO_EVENT'
                  ? 'i-heroicons-arrow-right'
                  : 'i-heroicons-arrow-left'
              "
              class="text-gray-400 size-5"
            />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.direction') }}</p>
              <p class="font-medium">
                {{
                  offer.direction === 'TO_EVENT'
                    ? $t('carpool.direction.to_event')
                    : $t('carpool.direction.from_event')
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Places et contact -->
        <div class="flex flex-wrap items-center gap-3">
          <UBadge :color="remainingSeats > 0 ? 'primary' : 'neutral'" variant="soft" size="md">
            {{ $t('components.carpool.seats_available', { count: remainingSeats }) }}
          </UBadge>
          <template v-if="offer.hasPhoneNumber && authStore.isAuthenticated">
            <div v-if="phoneRevealed && offer.phoneNumber" class="flex items-center gap-2 text-sm">
              <UIcon name="i-heroicons-phone" class="text-gray-400" />
              <span>{{ offer.phoneNumber }}</span>
              <UButton
                size="xs"
                variant="soft"
                icon="i-heroicons-phone"
                :href="`tel:${offer.phoneNumber}`"
              >
                {{ $t('components.carpool.call') }}
              </UButton>
            </div>
            <UButton
              v-else-if="offer.phoneNumber"
              size="sm"
              variant="soft"
              icon="i-heroicons-phone"
              @click="phoneRevealed = true"
            >
              {{ $t('components.carpool.reveal_contact') }}
            </UButton>
          </template>
        </div>

        <!-- Description -->
        <p v-if="offer.description" class="text-gray-600 dark:text-gray-400">
          {{ offer.description }}
        </p>

        <!-- Préférences -->
        <div
          v-if="offer.smokingAllowed || offer.petsAllowed || offer.musicAllowed"
          class="flex flex-wrap gap-2"
        >
          <UBadge
            v-if="offer.smokingAllowed"
            color="neutral"
            variant="soft"
            class="flex items-center gap-1"
          >
            <UIcon name="i-heroicons-no-symbol" class="w-4 h-4" />
            {{ $t('carpool.smoking_allowed') }}
          </UBadge>
          <UBadge
            v-if="offer.petsAllowed"
            color="neutral"
            variant="soft"
            class="flex items-center gap-1"
          >
            <UIcon name="i-heroicons-heart" class="w-4 h-4" />
            {{ $t('carpool.pets_allowed') }}
          </UBadge>
          <UBadge
            v-if="offer.musicAllowed"
            color="neutral"
            variant="soft"
            class="flex items-center gap-1"
          >
            <UIcon name="i-heroicons-musical-note" class="w-4 h-4" />
            {{ $t('carpool.music_allowed') }}
          </UBadge>
        </div>
      </div>
    </UCard>

    <!-- Ma réservation -->
    <UCard v-if="authStore.isAuthenticated && !canEdit && myBooking">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-ticket" class="text-primary-500" />
          <span class="font-semibold">{{ $t('components.carpool.my_booking') }}</span>
        </div>
        <UBadge
          :color="
            myBooking.status === 'ACCEPTED'
              ? 'success'
              : myBooking.status === 'REJECTED'
                ? 'error'
                : myBooking.status === 'CANCELLED'
                  ? 'neutral'
                  : 'warning'
          "
          variant="soft"
        >
          {{ bookingStatusLabel }}
        </UBadge>
      </div>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {{ $t('components.carpool.requested_seats', { count: myBooking.seats }) }}
      </p>
      <p v-if="myBooking.message" class="mt-1 text-sm text-gray-500 italic">
        "{{ myBooking.message }}"
      </p>
      <div v-if="myBooking.status === 'PENDING' || myBooking.status === 'ACCEPTED'" class="mt-3">
        <UButton
          size="sm"
          color="error"
          variant="soft"
          :loading="isCancelling"
          @click="cancelMyBooking"
        >
          {{ $t('common.cancel') }}
        </UButton>
      </div>
    </UCard>

    <!-- Réserver des places -->
    <UCard
      v-if="
        authStore.isAuthenticated &&
        !canEdit &&
        remainingSeats > 0 &&
        (!myBooking || myBooking.status === 'REJECTED' || myBooking.status === 'CANCELLED')
      "
    >
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-ticket" class="text-primary-500" />
          <h3 class="font-semibold">{{ $t('components.carpool.book_seats') }}</h3>
        </div>
      </template>

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
        <UFormField :label="$t('components.carpool.booking_message')">
          <UTextarea
            v-model="bookingMessage"
            :placeholder="$t('components.carpool.booking_message_placeholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <UButton
          color="primary"
          icon="i-heroicons-ticket"
          :disabled="isBooking || bookingSeats < 1"
          :loading="isBooking"
          @click="submitBooking"
        >
          {{ $t('components.carpool.confirm_booking') }}
        </UButton>
      </div>
    </UCard>

    <!-- Passagers confirmés -->
    <UCard v-if="acceptedBookings.length > 0">
      <template #header>
        <h3 class="font-semibold">{{ $t('components.carpool.confirmed_passengers') }}</h3>
      </template>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="b in acceptedBookings"
          :key="b.id"
          class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-full"
        >
          <UiUserDisplay :user="b.requester" :datetime="b.createdAt" size="xs" />
          <UBadge color="success" variant="soft">+{{ b.seats }}</UBadge>
        </div>
      </div>
    </UCard>

    <!-- Gestion des réservations (propriétaire) -->
    <UCard v-if="canEdit">
      <EditionCarpoolBookingsList :offer-id="offer.id" @updated="emit('booking-updated')" />
    </UCard>

    <!-- Commentaires -->
    <UCard>
      <EditionCarpoolCommentsInline
        :id="offer.id"
        type="offer"
        @comment-added="emit('comment-added')"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { CarpoolOffer } from '~/types/carpool'

interface Props {
  offer: CarpoolOffer
  editionId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'comment-added': []
  'booking-updated': []
  edit: []
  deleted: []
}>()

const authStore = useAuthStore()
const { t } = useI18n()
const router = useRouter()

const canEdit = computed(() => authStore.user?.id === props.offer.user?.id)
const phoneRevealed = ref(false)

const remainingSeats = computed(() => {
  if (typeof props.offer.remainingSeats === 'number') return props.offer.remainingSeats
  const bookings = props.offer.bookings || []
  const accepted = bookings
    .filter((b) => b.status === 'ACCEPTED')
    .reduce((s, b) => s + (b.seats || 0), 0)
  return Math.max(0, props.offer.availableSeats - accepted)
})

const acceptedBookings = computed(() =>
  (props.offer.bookings || []).filter((b) => b.status === 'ACCEPTED')
)

const formatTripDate = (date: string) => {
  const { locale } = useI18n()
  return new Date(date).toLocaleString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Ma réservation
interface MyBooking {
  id: number
  seats: number
  status: string
  message?: string
  createdAt: string
}

const myBookings = ref<MyBooking[]>([])
const myBooking = computed(() => {
  if (!myBookings.value.length) return null
  return [...myBookings.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]
})

const bookingStatusLabel = computed(() => {
  if (!myBooking.value) return ''
  return t(`components.carpool.status.${myBooking.value.status.toLowerCase()}`)
})

const loadMyBookings = async () => {
  if (!authStore.isAuthenticated || canEdit.value) return
  try {
    const data = await $fetch(`/api/carpool-offers/${props.offer.id}/bookings`)
    myBookings.value = Array.isArray(data) ? data : []
  } catch {
    // silencieux
  }
}

onMounted(loadMyBookings)

// Réservation
const bookingSeats = ref(1)
const bookingMessage = ref('')

const { execute: submitBooking, loading: isBooking } = useApiAction(
  () => `/api/carpool-offers/${props.offer.id}/bookings`,
  {
    method: 'POST',
    body: () => ({
      seats: bookingSeats.value,
      message: bookingMessage.value.trim() || undefined,
    }),
    successMessage: {
      title: t('messages.booking_requested'),
      description: t('messages.booking_requested_successfully'),
    },
    errorMessages: { default: t('errors.generic_error') },
    onSuccess: () => {
      bookingMessage.value = ''
      loadMyBookings()
    },
  }
)

// Annulation
const { execute: executeCancelBooking, loading: isCancelling } = useApiAction(
  () => `/api/carpool-offers/${props.offer.id}/bookings/${myBooking.value?.id}`,
  {
    method: 'PUT',
    body: () => ({ action: 'CANCEL' }),
    successMessage: { title: t('messages.booking_cancelled') },
    errorMessages: { default: t('errors.generic_error') },
    onSuccess: () => loadMyBookings(),
  }
)

const cancelMyBooking = () => {
  if (!myBooking.value) return
  executeCancelBooking()
}

// Suppression
const { execute: executeDeleteOffer } = useApiAction(
  () => `/api/carpool-offers/${props.offer.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.offer_deleted') },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: () => {
      emit('deleted')
      router.push(`/editions/${props.editionId}/carpool`)
    },
  }
)

const handleDelete = () => {
  if (!confirm(t('components.carpool.confirm_delete_offer'))) return
  executeDeleteOffer()
}
</script>
