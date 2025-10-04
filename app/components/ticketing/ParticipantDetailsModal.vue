<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('editions.ticketing.participant_modal_title')"
    :description="$t('editions.ticketing.participant_modal_description')"
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #body>
      <!-- Affichage pour un billet -->
      <div v-if="isTicket && participant && 'ticket' in participant" class="space-y-6">
        <!-- Statut du billet -->
        <div class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('editions.ticketing.ticket_status') }}
            </p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ participant.ticket.state }}
            </p>
          </div>
          <UBadge
            :color="participant.ticket.state === 'Processed' ? 'success' : 'neutral'"
            variant="soft"
            size="lg"
          >
            {{
              participant.ticket.state === 'Processed'
                ? 'Valide'
                : participant.ticket.state === 'Cancelled'
                  ? 'Annulé'
                  : participant.ticket.state
            }}
          </UBadge>
        </div>

        <!-- Informations de la commande -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-shopping-cart" class="text-purple-600 dark:text-purple-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.order') }}
            </h4>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.buyer') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.order.payer.firstName }}
                {{ participant.ticket.order.payer.lastName }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.buyer_email') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.order.payer.email }}
              </p>
            </div>
          </div>

          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('editions.ticketing.order_id') }}
            </p>
            <p class="text-sm font-mono font-medium text-gray-900 dark:text-white">
              #{{ participant.ticket.order.id }}
            </p>
          </div>
        </div>

        <!-- Informations des participants -->
        <div
          v-if="participant.ticket.order.items && participant.ticket.order.items.length > 0"
          class="space-y-4"
        >
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{
                participant.ticket.order.items.length > 1
                  ? 'Participants'
                  : $t('editions.ticketing.participant')
              }}
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in participant.ticket.order.items"
              :key="item.id"
              class="p-3 rounded-lg relative"
              :class="
                item.entryValidated
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 opacity-75'
                  : 'bg-gray-50 dark:bg-gray-900'
              "
            >
              <!-- Badge "Déjà validé" en haut à droite -->
              <div
                v-if="item.entryValidated"
                class="absolute top-2 right-2 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
              >
                <UIcon name="i-heroicons-check-circle-solid" class="h-4 w-4" />
                Déjà validé
              </div>

              <div class="flex items-start gap-3">
                <input
                  v-if="!item.entryValidated"
                  :id="`participant-${item.id}`"
                  v-model="selectedParticipants"
                  type="checkbox"
                  :value="item.id"
                  class="mt-1.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div
                  v-else
                  class="mt-1.5 h-4 w-4 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-check"
                    class="h-3 w-3 text-green-600 dark:text-green-400"
                  />
                </div>

                <div class="flex-1">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('editions.ticketing.full_name') }}
                      </p>
                      <p
                        class="text-sm font-medium"
                        :class="
                          item.entryValidated
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        "
                      >
                        {{ item.firstName || '-' }} {{ item.lastName || '-' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('editions.ticketing.email') }}
                      </p>
                      <p
                        class="text-sm font-medium"
                        :class="
                          item.entryValidated
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        "
                      >
                        {{ item.email || '-' }}
                      </p>
                    </div>
                  </div>
                  <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Type de billet</p>
                        <p
                          class="text-sm font-medium"
                          :class="
                            item.entryValidated
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-900 dark:text-white'
                          "
                        >
                          {{ item.name }}
                        </p>
                      </div>
                      <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {{ $t('editions.ticketing.amount') }}
                        </p>
                        <p
                          class="text-sm font-medium"
                          :class="
                            item.entryValidated
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-primary-600 dark:text-primary-400'
                          "
                        >
                          {{ (item.amount / 100).toFixed(2) }} €
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bouton dévalider en bas de la carte -->
              <div
                v-if="item.entryValidated"
                class="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex justify-end"
              >
                <UButton
                  color="error"
                  variant="soft"
                  size="xs"
                  icon="i-heroicons-x-circle"
                  @click="invalidateTicket(item.id)"
                >
                  Dévalider l'entrée
                </UButton>
              </div>
            </div>
          </div>

          <!-- Bouton pour tout sélectionner/désélectionner -->
          <div class="flex justify-end">
            <UButton
              v-if="
                selectedParticipants.length <
                participant.ticket.order.items.filter((item) => !item.entryValidated).length
              "
              variant="ghost"
              size="sm"
              @click="selectAllParticipants"
            >
              Tout sélectionner
            </UButton>
            <UButton v-else variant="ghost" size="sm" @click="selectedParticipants = []">
              Tout désélectionner
            </UButton>
          </div>
        </div>

        <!-- Options choisies (si disponibles) -->
        <div v-if="participant.ticket.customFields && participant.ticket.customFields.length > 0">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon
              name="i-heroicons-adjustments-horizontal"
              class="text-blue-600 dark:text-blue-400"
            />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.options') }}
            </h4>
          </div>

          <div class="space-y-2 mt-4">
            <div
              v-for="(field, idx) in participant.ticket.customFields"
              :key="idx"
              class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ field.name }}</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ field.answer }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Affichage pour un bénévole -->
      <div v-else-if="isVolunteer && participant && 'volunteer' in participant" class="space-y-6">
        <!-- Badge bénévole -->
        <div
          class="flex items-center justify-between p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20"
        >
          <div>
            <p class="text-sm text-purple-600 dark:text-purple-400">
              {{ $t('editions.ticketing.access_type') }}
            </p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.volunteer') }}
            </p>
          </div>
          <UBadge color="primary" variant="soft" size="lg">
            {{ $t('editions.ticketing.volunteer_accepted') }}
          </UBadge>
        </div>

        <!-- Statut de validation d'entrée -->
        <div
          v-if="participant.volunteer.entryValidated"
          class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-check-circle-solid"
              class="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
            />
            <div class="flex-1">
              <p class="font-medium text-green-900 dark:text-green-100">Entrée déjà validée</p>
              <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                <span v-if="participant.volunteer.entryValidatedBy">
                  Validé par {{ participant.volunteer.entryValidatedBy.firstName }}
                  {{ participant.volunteer.entryValidatedBy.lastName }}
                </span>
                <span v-else>Le bénévole a validé son entrée</span>
                {{
                  participant.volunteer.entryValidatedAt
                    ? `le ${new Date(participant.volunteer.entryValidatedAt).toLocaleDateString(
                        'fr-FR',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}`
                    : ''
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Informations du bénévole -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.volunteer') }}
            </h4>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.full_name') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.volunteer.user.firstName }}
                {{ participant.volunteer.user.lastName }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.email') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.volunteer.user.email }}
              </p>
            </div>
          </div>
        </div>

        <!-- Équipes assignées -->
        <div
          v-if="participant.volunteer.teams && participant.volunteer.teams.length > 0"
          class="space-y-4"
        >
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-user-group" class="text-blue-600 dark:text-blue-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.teams') }}
            </h4>
          </div>

          <div class="space-y-2">
            <div
              v-for="team in participant.volunteer.teams"
              :key="team.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-group" class="h-4 w-4 text-blue-500" />
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ team.name }}
                </span>
              </div>
              <UBadge v-if="team.isLeader" color="primary" variant="soft" size="sm">
                Responsable
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Créneaux assignés -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-clock" class="text-orange-600 dark:text-orange-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.time_slots') }}
            </h4>
          </div>

          <div
            v-if="participant.volunteer.timeSlots && participant.volunteer.timeSlots.length > 0"
            class="space-y-2"
          >
            <div
              v-for="slot in participant.volunteer.timeSlots"
              :key="slot.id"
              class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-calendar"
                    class="h-4 w-4 text-orange-500 flex-shrink-0"
                  />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ slot.title }}
                  </span>
                </div>
                <UBadge v-if="slot.team" color="neutral" variant="subtle" size="xs">
                  {{ slot.team }}
                </UBadge>
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 ml-6">
                {{
                  new Date(slot.startDateTime).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                }}
                -
                {{ new Date(slot.endDateTime).toLocaleString('fr-FR', { timeStyle: 'short' }) }}
              </div>
            </div>
          </div>

          <div
            v-else
            class="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <UIcon name="i-heroicons-calendar-days" class="mx-auto h-8 w-8 mb-2 text-gray-400" />
            <p class="text-sm">Aucun créneau assigné</p>
          </div>
        </div>
      </div>

      <!-- Message si aucun participant -->
      <div v-else class="py-8 text-center">
        <UIcon name="i-heroicons-user-circle" class="mx-auto h-16 w-16 text-gray-400 mb-3" />
        <p class="text-gray-500">{{ $t('editions.ticketing.no_info_available') }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between items-center">
        <div
          v-if="isTicket && selectedParticipants.length > 0"
          class="text-sm text-gray-600 dark:text-gray-400"
        >
          {{ selectedParticipants.length }} participant{{
            selectedParticipants.length > 1 ? 's' : ''
          }}
          sélectionné{{ selectedParticipants.length > 1 ? 's' : '' }}
        </div>
        <div v-else></div>
        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" @click="isOpen = false"> Fermer </UButton>
          <UButton
            v-if="isTicket && selectedParticipants.length > 0"
            color="success"
            icon="i-heroicons-check-circle"
            :loading="validating"
            @click="showValidateTicketsConfirm"
          >
            Valider l'entrée ({{ selectedParticipants.length }})
          </UButton>
          <UButton
            v-if="isVolunteer && participant && 'volunteer' in participant"
            :color="participant.volunteer.entryValidated ? 'error' : 'success'"
            :icon="
              participant.volunteer.entryValidated
                ? 'i-heroicons-x-circle'
                : 'i-heroicons-check-circle'
            "
            :loading="validating"
            @click="
              participant.volunteer.entryValidated ? showInvalidateConfirm() : showValidateConfirm()
            "
          >
            {{ participant.volunteer.entryValidated ? "Dévalider l'entrée" : "Valider l'entrée" }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal de confirmation de validation -->
  <UiConfirmModal
    v-model="showValidateModal"
    :title="
      isTicket && selectedParticipants.length > 1 ? 'Valider les entrées' : 'Valider l\'entrée'
    "
    :description="
      isTicket && selectedParticipants.length > 1
        ? `Êtes-vous sûr de vouloir valider l'entrée de ces ${selectedParticipants.length} participants ?`
        : 'Êtes-vous sûr de vouloir valider l\'entrée de ce participant ?'
    "
    confirm-label="Valider"
    confirm-color="success"
    confirm-icon="i-heroicons-check-circle"
    icon-name="i-heroicons-information-circle"
    icon-color="text-blue-500"
    :loading="validating"
    :checklist-items="returnableItemsToDistribute"
    checklist-title="Articles à remettre au participant"
    checklist-icon="i-heroicons-gift"
    checklist-icon-color="text-orange-600 dark:text-orange-400"
    checklist-warning="Vous devez cocher tous les articles avant de pouvoir valider l'entrée"
    @confirm="confirmValidateEntry"
    @cancel="showValidateModal = false"
  />

  <!-- Modal de confirmation de dévalidation -->
  <UiConfirmModal
    v-model="showInvalidateModal"
    title="Dévalider l'entrée"
    description="Êtes-vous sûr de vouloir dévalider l'entrée de ce participant ? Cette action annulera la validation."
    confirm-label="Dévalider"
    confirm-color="error"
    confirm-icon="i-heroicons-x-circle"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="validating"
    @confirm="invalidateEntry"
    @cancel="showInvalidateModal = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface TicketData {
  ticket: {
    id: number
    name: string
    amount: number
    state: string
    qrCode?: string
    user: {
      firstName: string
      lastName: string
      email: string
    }
    order: {
      id: number
      payer: {
        firstName: string
        lastName: string
        email: string
      }
      items?: Array<{
        id: number
        name: string
        amount: number
        state: string
        qrCode?: string
        firstName?: string
        lastName?: string
        email?: string
        entryValidated?: boolean
        entryValidatedAt?: string | Date
        customFields?: Array<{
          name: string
          answer: string
        }>
        tier?: {
          id: number
          name: string
          returnableItems?: Array<{
            returnableItem: {
              id: number
              name: string
            }
          }>
        }
      }>
    }
    customFields?: Array<{
      name: string
      answer: string
    }>
  }
}

interface VolunteerData {
  volunteer: {
    id: number
    user: {
      firstName: string
      lastName: string
      email: string
    }
    teams: Array<{
      id: number
      name: string
      isLeader: boolean
    }>
    timeSlots?: Array<{
      id: number
      title: string
      team?: string
      startDateTime: Date | string
      endDateTime: Date | string
    }>
    entryValidated?: boolean
    entryValidatedAt?: Date | string
    entryValidatedBy?: {
      firstName: string
      lastName: string
    }
  }
}

type ParticipantData = TicketData | VolunteerData

const props = defineProps<{
  open: boolean
  participant?: ParticipantData
  type?: 'ticket' | 'volunteer'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  validate: [participantIds: number[]]
  invalidate: [participantId: number]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const isVolunteer = computed(() => props.type === 'volunteer')
const isTicket = computed(() => props.type === 'ticket' || !props.type)

// Gestion de la sélection des participants
const selectedParticipants = ref<number[]>([])
const validating = ref(false)
const showValidateModal = ref(false)
const showInvalidateModal = ref(false)
const ticketToInvalidate = ref<number | null>(null)

// Gestion des articles à restituer
const returnableItemsToDistribute = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return []

  // Récupérer tous les articles à restituer des participants sélectionnés
  const itemsList: Array<{ id: string; name: string; participantName: string }> = []

  const itemsToCheck =
    props.participant.ticket.order.items?.filter((item) =>
      selectedParticipants.value.includes(item.id)
    ) || []

  for (const item of itemsToCheck) {
    const participantName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Participant'

    if (item.tier?.returnableItems) {
      for (const tierItem of item.tier.returnableItems) {
        // Créer un ID unique par participant et article
        itemsList.push({
          id: `${item.id}-${tierItem.returnableItem.id}`,
          name: `${tierItem.returnableItem.name} - ${participantName}`,
          participantName,
        })
      }
    }
  }

  return itemsList
})

// Réinitialiser la sélection quand la modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      selectedParticipants.value = []
    }
  }
)

const selectAllParticipants = () => {
  if (props.participant && 'ticket' in props.participant) {
    // Ne sélectionner que les participants non-validés
    selectedParticipants.value =
      props.participant.ticket.order.items
        ?.filter((item) => !item.entryValidated)
        .map((item) => item.id) || []
  }
}

const showValidateTicketsConfirm = () => {
  if (selectedParticipants.value.length === 0) return
  showValidateModal.value = true
}

const showValidateConfirm = () => {
  showValidateModal.value = true
}

const confirmValidateEntry = async () => {
  validating.value = true
  try {
    // Si c'est un bénévole
    if (props.participant && 'volunteer' in props.participant) {
      emit('validate', [props.participant.volunteer.id])
    }
    // Si ce sont des tickets sélectionnés
    else if (selectedParticipants.value.length > 0) {
      emit('validate', selectedParticipants.value)
    }
    showValidateModal.value = false
  } finally {
    validating.value = false
  }
}

const showInvalidateConfirm = () => {
  showInvalidateModal.value = true
}

const invalidateTicket = (ticketId: number) => {
  ticketToInvalidate.value = ticketId
  showInvalidateModal.value = true
}

const invalidateEntry = async () => {
  validating.value = true
  try {
    // Si c'est un bénévole
    if (props.participant && 'volunteer' in props.participant) {
      emit('invalidate', props.participant.volunteer.id)
    }
    // Si c'est un ticket
    else if (ticketToInvalidate.value) {
      emit('invalidate', ticketToInvalidate.value)
    }
    showInvalidateModal.value = false
    ticketToInvalidate.value = null
  } finally {
    validating.value = false
  }
}
</script>
