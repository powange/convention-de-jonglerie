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
          <!-- Dire POURQUOI il n'y a pas de formulaire. Sans ce badge, l'offre d'hier s'affiche
               comme une autre et son absence de bouton passe pour un défaut. -->
          <UBadge v-if="trajetPasse" color="neutral" variant="soft">
            {{ $t('components.carpool.past_trip') }}
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
            <!-- ⚠️ LA TROISIÈME BRANCHE, CELLE QUI MANQUAIT.
                 `hasPhoneNumber: true` avec `phoneNumber: null` est l'état d'un passager connecté
                 dont la réservation n'est pas encore acceptée. Le bloc s'ouvrait donc sur le BON
                 drapeau — celui qui existe précisément pour dire « il y a un numéro, mais pas pour
                 vous » — puis ses deux branches exigeaient le numéro et ne rendaient RIEN : ni
                 bouton, ni explication. Le passager ne savait pas s'il devait attendre ou
                 commenter. La condition testait la bonne information et la jetait. -->
            <div v-else class="flex items-center gap-2 text-sm text-gray-500">
              <UIcon name="i-heroicons-phone" />
              <span>{{ $t('components.carpool.phone_after_acceptance') }}</span>
            </div>
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

    <!-- ⚠️ `trajetPasse` DANS LA CONDITION : la liste filtre bien sur la date, mais l'option
         « Afficher tout » ramène les offres passées. Le formulaire n'était gardé que par les places
         restantes, si bien qu'une offre d'hier restait réservable — et le conducteur recevait une
         notification pour un trajet terminé. Le serveur refuse désormais ; l'écran ne doit pas
         proposer un geste qui sera refusé. -->
    <UCard
      v-if="
        authStore.isAuthenticated &&
        !canEdit &&
        !trajetPasse &&
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

    <EditionCarpoolConfirmDeleteOffer
      v-model:open="suppressionADemander"
      :passenger-count="acceptedBookings.length"
      @confirm="executeDeleteOffer"
    />
  </div>
</template>

<script setup lang="ts">
import type { CarpoolOffer } from '~/types/carpool'

import { useAuthStore } from '#imports'

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
const { t, locale } = useI18n()
const router = useRouter()

const canEdit = computed(() => authStore.user?.id === props.offer.user?.id)

/**
 * Le trajet est-il déjà parti ?
 *
 * ⚠️ `Number.isFinite` et non un test de vérité : une date illisible donne `NaN`, et **toute
 * comparaison avec `NaN` est fausse**. Le trajet serait alors tenu pour à venir — pas d'erreur, pas
 * de badge, un formulaire proposé pour un geste que le serveur refusera. Même famille de piège que
 * `Math.max(1, NaN)`, déjà payée ici.
 */
const trajetPasse = computed(() => {
  const instant = new Date(props.offer.tripDate).getTime()
  return Number.isFinite(instant) && instant < Date.now()
})
const phoneRevealed = ref(false)

/*
 * Une seule définition des places restantes pour tout le module (`utils/places-restantes.ts`).
 * Cette règle était recopiée à l'identique ici et dans son voisin, et le filtre « avec des places
 * libres » en aurait écrit une troisième : la liste aurait pu masquer une offre que cette fiche
 * annonce encore disponible.
 */
const remainingSeats = computed(() => placesRestantes(props.offer))

const acceptedBookings = computed(() =>
  (props.offer.bookings || []).filter((b) => b.status === 'ACCEPTED')
)

// Un seul formateur pour tout le module — cet écran était déjà au bon fuseau, mais dupliquait
// le format, et c'est cette duplication qui avait laissé ses voisins diverger.
const formatTripDate = (date: string) => formatCarpoolDate(date, locale.value)

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

/*
 * Même confirmation que sur la carte, par le même composant : la question posée et le compte de
 * passagers doivent être identiques des deux côtés — c'est la même offre qu'on supprime.
 */
const suppressionADemander = ref(false)

const handleDelete = () => {
  suppressionADemander.value = true
}
</script>
