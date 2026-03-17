<template>
  <NuxtLink :to="`/editions/${editionId}/carpool/offers/${offer.id}`" class="block">
    <UCard
      :ref="highlighted ? 'highlightedCard' : undefined"
      :class="[
        highlighted ? 'ring-2 ring-primary-500 shadow-lg' : '',
        'hover:shadow-md transition-shadow cursor-pointer',
      ]"
    >
      <div class="space-y-4">
        <!-- En-tête avec les infos utilisateur -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <UiUserDisplay :user="offer.user" :datetime="offer.createdAt" size="lg" />
          </div>

          <!-- Boutons d'action pour le créateur -->
          <div v-if="canEdit" class="flex gap-1">
            <UButton
              icon="i-heroicons-pencil"
              size="xs"
              color="warning"
              variant="ghost"
              :title="$t('components.carpool.edit_offer')"
              @click.stop="emit('edit')"
            />
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              color="error"
              variant="ghost"
              :title="$t('components.carpool.delete_offer')"
              @click.stop="handleDelete"
            />
          </div>
          <div class="text-right">
            <UBadge :color="remainingSeats > 0 ? 'primary' : 'neutral'" variant="soft" class="mb-2">
              {{ $t('components.carpool.seats_available', { count: remainingSeats }) }}
            </UBadge>
            <div class="text-sm">
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ formatDate(offer.tripDate) }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ offer.locationCity }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end">
                <UIcon
                  :name="
                    offer.direction === 'TO_EVENT'
                      ? 'i-heroicons-arrow-right'
                      : 'i-heroicons-arrow-left'
                  "
                  class="text-gray-400 w-4 h-4"
                />
                <span class="text-sm font-medium">{{
                  offer.direction === 'TO_EVENT'
                    ? $t('carpool.direction.to_event')
                    : $t('carpool.direction.from_event')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Détails du trajet -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-map" class="text-gray-400" />
            <span class="font-medium">{{ $t('components.carpool.address') }} :</span>
            <span>{{ offer.locationAddress }}</span>
          </div>
        </div>

        <!-- Description -->
        <p v-if="offer.description" class="text-sm text-gray-600 dark:text-gray-400">
          {{ offer.description }}
        </p>

        <!-- Préférences -->
        <div class="flex flex-wrap gap-2">
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

        <!-- Réservations acceptées (résumé) -->
        <div v-if="acceptedBookings.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('components.carpool.confirmed_passengers') }} :
          </h4>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="b in acceptedBookings"
              :key="b.id"
              class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-sm"
            >
              <UiUserDisplay :user="b.requester" :datetime="b.createdAt" size="xs" />
              <UBadge color="success" variant="soft">+{{ b.seats }}</UBadge>
            </div>
          </div>
        </div>

        <!-- Nombre de commentaires -->
        <div v-if="offer.comments && offer.comments.length > 0" class="pt-2">
          <div class="flex items-center gap-1 text-sm text-gray-500">
            <UIcon name="i-heroicons-chat-bubble-left" class="w-4 h-4" />
            {{ $t('components.carpool.view_comments', { count: offer.comments.length }) }}
          </div>
        </div>
      </div>
    </UCard>
  </NuxtLink>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { CarpoolOffer } from '~/types/carpool'

interface Props {
  offer: CarpoolOffer
  editionId: number
  highlighted?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  edit: []
  deleted: []
}>()

const authStore = useAuthStore()
const { t } = useI18n()

// Vérifier si l'utilisateur peut éditer cette offre
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.offer.user.id
})

// Défilement automatique vers l'offre mise en évidence
const highlightedCard = ref<HTMLElement>()

onMounted(() => {
  if (props.highlighted && highlightedCard.value) {
    nextTick(() => {
      highlightedCard.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }
})

// Calculer les places restantes: si fourni par l'API via bookings ACCEPTED, sinon fallback sur passagers
const remainingSeats = computed(() => {
  if (typeof props.offer.remainingSeats === 'number') return props.offer.remainingSeats
  const bookings = props.offer.bookings || []
  const accepted = bookings
    .filter((b) => b.status === 'ACCEPTED')
    .reduce((s, b) => s + (b.seats || 0), 0)
  return Math.max(0, props.offer.availableSeats - accepted)
})

const formatDate = (date: string) => {
  const { locale } = useI18n()
  return new Date(date).toLocaleString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const { execute: executeDeleteOffer } = useApiAction(
  () => `/api/carpool-offers/${props.offer.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: t('messages.offer_deleted'),
      description: t('messages.offer_deleted_successfully'),
    },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: () => emit('deleted'),
  }
)

const handleDelete = () => {
  if (!confirm(t('components.carpool.confirm_delete_offer'))) return
  executeDeleteOffer()
}

const acceptedBookings = computed(() =>
  (props.offer.bookings || []).filter((b) => b.status === 'ACCEPTED')
)
</script>
