<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <UIcon name="i-heroicons-clipboard-document-list" />
      <!-- « Réservations » et non « Réservations en attente » : la liste montre AUSSI les
           acceptées et les refusées, badge compris. Le titre promettait une liste filtrée qui
           n'existe pas. -->
      <span class="font-medium">{{ $t('components.carpool.bookings') }}</span>
    </div>
    <div v-if="bookings.length === 0" class="text-sm text-gray-500">
      <!-- « Aucune réservation » : la liste n'est pas filtrée, donc un vide signifie qu'il n'y en
           a aucune — ni en attente, ni traitée. -->
      {{ $t('components.carpool.no_bookings') }}
    </div>
    <div v-else class="space-y-2">
      <!-- `items-start` et non `items-center` : le message du passager peut faire plusieurs
           lignes, et centrer verticalement ferait flotter les boutons au milieu du texte. -->
      <div
        v-for="b in bookings"
        :key="b.id"
        class="flex items-start justify-between gap-3 border rounded p-2"
        data-reservation
      >
        <div class="flex min-w-0 items-start gap-2">
          <UiUserAvatar :user="b.requester" size="xs" />
          <div class="min-w-0">
            <div class="font-medium">{{ b.requester.pseudo }}</div>
            <div class="text-xs text-gray-500">
              {{ $t('components.carpool.requested_seats', { count: b.seats }) }}
            </div>
            <!-- ⚠️ LE MESSAGE DU PASSAGER, QUE LE CONDUCTEUR NE VOYAIT NULLE PART.
                 Le passager le saisit, l'API le renvoie — et cet écran, le SEUL du conducteur,
                 affichait pseudo, places et boutons. Il acceptait ou refusait à l'aveugle, et la
                 seule trace du message était le texte de la notification.
                 `whitespace-pre-line` : un passager écrit « je peux récupérer à la gare /
                 arrivée vers 18 h » sur deux lignes, et les coller en ferait une phrase. -->
            <p
              v-if="b.message"
              class="mt-1 whitespace-pre-line break-words text-sm italic text-gray-600 dark:text-gray-400"
            >
              {{ b.message }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UBadge
            v-if="b.status !== 'PENDING'"
            :color="
              b.status === 'ACCEPTED' ? 'success' : b.status === 'REJECTED' ? 'error' : 'neutral'
            "
          >
            <!-- Le code brut `ACCEPTED` s'affichait tel quel. La clé existe pourtant déjà, et
                 `OfferDetail.vue` l'emploie pour le MÊME statut vu du passager : les deux côtés de
                 la même réservation le nommaient différemment. -->
            {{ $t(`components.carpool.status.${b.status.toLowerCase()}`) }}
          </UBadge>
          <!-- Retirer une place déjà accordée. Le conducteur ne pouvait pas le faire : il ne lui
               restait qu'à supprimer l'offre entière, ce qui prévient tout le monde pour retirer
               une seule personne. Le bouton est discret (`ghost`) à côté du badge « accepté » :
               c'est une exception, pas l'action ordinaire de cette ligne. -->
          <UButton
            v-if="b.status === 'ACCEPTED'"
            size="xs"
            color="error"
            variant="ghost"
            :loading="isUpdating(b.id)"
            @click="demanderLeRetrait(b)"
            >{{ $t('components.carpool.revoke_seat') }}</UButton
          >
          <template v-if="b.status === 'PENDING'">
            <UButton
              size="xs"
              color="success"
              variant="soft"
              :loading="isUpdating(b.id)"
              @click="update(b.id, 'ACCEPT')"
              >{{ $t('components.carpool.accept') }}</UButton
            >
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :loading="isUpdating(b.id)"
              @click="update(b.id, 'REJECT')"
              >{{ $t('components.carpool.reject') }}</UButton
            >
          </template>
        </div>
      </div>
    </div>

    <!-- Le retrait est SANS RETOUR : le serveur n'autorise `ACCEPT` que depuis « en attente », donc
         une place retirée ne peut pas être rendue — le passager doit refaire une demande. Un bouton
         à un clic, collé au badge « accepté », ne va pas avec une action irréversible qui prévient
         quelqu'un. D'où cette confirmation, qui nomme la personne concernée. -->
    <UModal
      v-model:open="retraitADemander"
      :title="$t('components.carpool.revoke_seat_title')"
      :description="
        $t('components.carpool.revoke_seat_description', {
          pseudo: reservationARetirer?.requester?.pseudo ?? '',
        })
      "
    >
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="retraitADemander = false">
            {{ $t('common.cancel') }}
          </UButton>
          <!-- Pas de `loading` ici : la modale se referme au clic, et c'est le bouton de la ligne
               qui porte l'attente — celle-ci reste visible, la modale non. -->
          <UButton color="error" @click="confirmerLeRetrait">
            {{ $t('components.carpool.revoke_seat') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface Props {
  offerId: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ updated: [] }>()

const bookings = ref<any[]>([])

const load = async () => {
  const data = await $fetch(`/api/carpool-offers/${props.offerId}/bookings`)
  bookings.value = data || []
}

onMounted(load)
watch(() => props.offerId, load)

const pendingAction = ref<'ACCEPT' | 'REJECT' | 'CANCEL'>('ACCEPT')

const { execute: executeUpdate, isLoading: isUpdating } = useApiActionById(
  (bookingId) => `/api/carpool-offers/${props.offerId}/bookings/${bookingId}`,
  {
    method: 'PUT',
    body: () => ({ action: pendingAction.value }),
    silentSuccess: true,
    onSuccess: async () => {
      await load()
      emit('updated')
    },
  }
)

const update = (bookingId: number, action: 'ACCEPT' | 'REJECT' | 'CANCEL') => {
  pendingAction.value = action
  executeUpdate(bookingId)
}

const retraitADemander = ref(false)
const reservationARetirer = ref<any>(null)

const demanderLeRetrait = (booking: any) => {
  reservationARetirer.value = booking
  retraitADemander.value = true
}

const confirmerLeRetrait = () => {
  const booking = reservationARetirer.value
  if (!booking) return
  // Refermer d'abord : `load()` remplace le tableau, et garder une référence vers l'ancienne ligne
  // ferait afficher un nom qui n'est plus celui de la liste.
  retraitADemander.value = false
  reservationARetirer.value = null
  update(booking.id, 'REJECT')
}
</script>
