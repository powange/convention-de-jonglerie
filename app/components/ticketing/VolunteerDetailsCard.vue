<template>
  <div class="space-y-6">
    <!-- Type d'accès -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
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
      v-if="volunteer.entryValidated"
      class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="i-heroicons-check-circle-solid"
          class="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
        />
        <div class="flex-1">
          <p class="font-medium text-green-900 dark:text-green-100">
            {{ $t('ticketing.participant.entry_validated') }}
          </p>
          <p class="text-sm text-green-700 dark:text-green-300 mt-1">
            <span v-if="volunteer.entryValidatedBy">
              Validé par {{ volunteer.entryValidatedBy.firstName }}
              {{ volunteer.entryValidatedBy.lastName }}
            </span>
            <span v-else>{{ $t('ticketing.participant.volunteer_validated') }}</span>
            {{
              volunteer.entryValidatedAt
                ? `le ${new Date(volunteer.entryValidatedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- Informations du bénévole -->
    <TicketingUserInfoSection
      ref="userInfoSection"
      :title="$t('editions.ticketing.volunteer')"
      :first-name="editableFirstName"
      :last-name="editableLastName"
      :email="editableEmail"
      :phone="editablePhone"
      :original-email="volunteer.user.email"
      :user-id="volunteer.user.id"
      @update:first-name="$emit('update:firstName', $event)"
      @update:last-name="$emit('update:lastName', $event)"
      @update:email="$emit('update:email', $event)"
      @update:phone="$emit('update:phone', $event)"
    />

    <!-- Équipes assignées -->
    <div v-if="volunteer.teams && volunteer.teams.length > 0" class="space-y-4">
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <UIcon name="i-heroicons-user-group" class="text-blue-600 dark:text-blue-400" />
        <h4 class="font-semibold text-gray-900 dark:text-white">
          {{ $t('editions.ticketing.teams') }}
        </h4>
      </div>

      <div class="space-y-2">
        <div
          v-for="team in volunteer.teams"
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

      <div v-if="volunteer.timeSlots && volunteer.timeSlots.length > 0" class="space-y-2">
        <div
          v-for="slot in volunteer.timeSlots"
          :key="slot.id"
          class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-calendar" class="h-4 w-4 text-orange-500 flex-shrink-0" />
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
        <p class="text-sm">{{ $t('ticketing.participant.no_slot_assigned') }}</p>
      </div>
    </div>

    <!-- Repas du bénévole -->
    <TicketingMealsDisplaySection :meals="volunteer.meals" />

    <!-- Boutons d'action -->
    <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
      <UButton
        :color="volunteer.entryValidated ? 'error' : 'success'"
        :icon="volunteer.entryValidated ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
        :loading="validating"
        :disabled="!volunteer.entryValidated && !isEmailValid"
        @click="volunteer.entryValidated ? $emit('invalidate') : $emit('validate')"
      >
        {{ volunteer.entryValidated ? "Dévalider l'entrée" : "Valider l'entrée" }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type TicketingUserInfoSection from './TicketingUserInfoSection.vue'

interface Volunteer {
  id: number
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
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
  meals?: Array<{
    id: number
    date: Date | string
    mealType: string
    phases?: string[]
  }>
  entryValidated?: boolean
  entryValidatedAt?: Date | string
  entryValidatedBy?: {
    firstName: string
    lastName: string
  }
}

defineProps<{
  volunteer: Volunteer
  editableFirstName: string | null
  editableLastName: string | null
  editableEmail: string | null
  editablePhone: string | null
  validating?: boolean
}>()

defineEmits<{
  'update:firstName': [value: string | null]
  'update:lastName': [value: string | null]
  'update:email': [value: string | null]
  'update:phone': [value: string | null]
  validate: []
  invalidate: []
}>()

// Référence au composant TicketingUserInfoSection qui contient EmailValidationInput
const userInfoSection = ref<InstanceType<typeof TicketingUserInfoSection> | null>(null)

// Vérifier si l'email est valide en accédant à emailInput via userInfoSection
const isEmailValid = computed(() => {
  return userInfoSection.value?.emailInput?.emailValidation?.isValid ?? true
})
</script>
