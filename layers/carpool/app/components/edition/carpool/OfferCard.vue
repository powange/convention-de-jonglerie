<template>
  <NuxtLink :to="`/editions/${editionId}/carpool/offers/${offer.id}`" class="block">
    <UCard class="hover:shadow-md transition-shadow cursor-pointer">
      <div class="space-y-4">
        <!-- En-tête avec les infos utilisateur -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <UiUserDisplay :user="offer.user" :datetime="offer.createdAt" size="lg" />
          </div>

          <!-- Boutons d'action pour le créateur -->
          <ClientOnly>
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
          </ClientOnly>
          <div class="text-right">
            <UBadge :color="remainingSeats > 0 ? 'primary' : 'neutral'" variant="soft" class="mb-2">
              {{ $t('components.carpool.seats_available', { count: remainingSeats }) }}
            </UBadge>
            <div class="text-sm">
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ formatTripDate(offer.tripDate) }}</span>
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

        <!-- Nombre de commentaires. La liste ne transporte plus que ce compte. -->
        <div v-if="nombreDeCommentaires > 0" class="pt-2">
          <div class="flex items-center gap-1 text-sm text-gray-500">
            <UIcon name="i-heroicons-chat-bubble-left" class="w-4 h-4" />
            {{ $t('components.carpool.view_comments', { count: nombreDeCommentaires }) }}
          </div>
        </div>
      </div>
    </UCard>
  </NuxtLink>

  <!-- Hors du `NuxtLink` : à l'intérieur, un clic dans la modale remonterait jusqu'au lien de la
       carte et ouvrirait l'offre au lieu de la supprimer. -->
  <EditionCarpoolConfirmDeleteOffer
    v-model:open="suppressionADemander"
    :passenger-count="acceptedBookings.length"
    @confirm="executeDeleteOffer"
  />
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
  edit: []
  deleted: []
}>()

const authStore = useAuthStore()
const { t, locale } = useI18n()

// Vérifier si l'utilisateur peut éditer cette offre
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.offer.user.id
})

/*
 * Une seule définition des places restantes pour tout le module (`utils/places-restantes.ts`).
 * Cette règle était recopiée à l'identique ici et dans son voisin, et le filtre « avec des places
 * libres » en aurait écrit une troisième : la liste aurait pu masquer une offre que cette fiche
 * annonce encore disponible.
 */
const remainingSeats = computed(() => placesRestantes(props.offer))

/*
 * Un seul formateur pour tout le module (`utils/date-covoiturage.ts`), au fuseau du NAVIGATEUR :
 * cet écran forçait `Europe/Paris` et son voisin non, d'où deux heures pour une même offre.
 */
const formatTripDate = (date: string) => formatCarpoolDate(date, locale.value)

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

/*
 * La confirmation passe par une `UModal` et non par `confirm()`. Depuis ce lot, supprimer une offre
 * NOTIFIE ses passagers : la question doit dire combien ils sont, ce que le `confirm()` natif ne
 * pouvait pas faire.
 */
const suppressionADemander = ref(false)

const handleDelete = () => {
  suppressionADemander.value = true
}

const acceptedBookings = computed(() =>
  (props.offer.bookings || []).filter((b) => b.status === 'ACCEPTED')
)

/**
 * La liste d'une édition ne rend que `commentsCount` ; le détail d'une offre rend les commentaires.
 * Le repli sur la longueur garde la carte juste dans les deux cas — et ne se contredit pas, parce
 * que le serveur omet `comments` plutôt que de le rendre vide quand il ne les a pas chargés.
 */
const nombreDeCommentaires = computed(
  () => props.offer.commentsCount ?? props.offer.comments?.length ?? 0
)
</script>
