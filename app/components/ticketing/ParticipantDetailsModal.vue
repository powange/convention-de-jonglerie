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

        <!-- Informations du participant -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.participant') }}
            </h4>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.full_name') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.user.firstName }} {{ participant.ticket.user.lastName }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.email') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.user.email }}
              </p>
            </div>
          </div>
        </div>

        <!-- Informations du tarif -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-ticket" class="text-orange-600 dark:text-orange-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.ticket') }}
            </h4>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.ticket_type') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.name }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('editions.ticketing.amount') }}
              </p>
              <p class="text-sm font-medium text-primary-600 dark:text-primary-400">
                {{ (participant.ticket.amount / 100).toFixed(2) }} €
              </p>
            </div>
          </div>

          <div v-if="participant.ticket.qrCode">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('editions.ticketing.qr_code') }}
            </p>
            <p class="text-sm font-mono font-medium text-gray-900 dark:text-white">
              {{ participant.ticket.qrCode }}
            </p>
          </div>
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
        <div
          v-if="participant.volunteer.timeSlots && participant.volunteer.timeSlots.length > 0"
          class="space-y-4"
        >
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-clock" class="text-orange-600 dark:text-orange-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('editions.ticketing.time_slots') }}
            </h4>
          </div>

          <div class="space-y-2">
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
        </div>
      </div>

      <!-- Message si aucun participant -->
      <div v-else class="py-8 text-center">
        <UIcon name="i-heroicons-user-circle" class="mx-auto h-16 w-16 text-gray-400 mb-3" />
        <p class="text-gray-500">{{ $t('editions.ticketing.no_info_available') }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Fermer </UButton>
        <UButton
          v-if="
            isTicket &&
            participant &&
            'ticket' in participant &&
            participant.ticket.state === 'Processed'
          "
          color="success"
          icon="i-heroicons-check-circle"
        >
          Marquer comme entré
        </UButton>
        <UButton
          v-if="isVolunteer && participant && 'volunteer' in participant"
          color="success"
          icon="i-heroicons-check-circle"
        >
          Marquer comme entré
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
    timeSlots: Array<{
      id: number
      title: string
      team?: string
      startDateTime: Date | string
      endDateTime: Date | string
    }>
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
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const isVolunteer = computed(() => props.type === 'volunteer')
const isTicket = computed(() => props.type === 'ticket' || !props.type)
</script>
