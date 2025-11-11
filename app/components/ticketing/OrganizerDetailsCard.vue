<template>
  <div class="space-y-6">
    <!-- Type d'accès -->
    <div
      class="flex items-center justify-between p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20"
    >
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-shield-check" class="text-indigo-500" size="32" />
        <div>
          <p class="text-sm text-indigo-600 dark:text-indigo-400">
            {{ $t('edition.ticketing.access_type') }}
          </p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('common.organizer') }}
          </p>
        </div>
      </div>
      <UBadge color="primary" variant="soft" size="lg">
        {{ organizer.title || $t('common.organizer') }}
      </UBadge>
    </div>

    <!-- Statut de validation d'entrée -->
    <div
      v-if="organizer.entryValidated"
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
            <span v-if="organizer.entryValidatedBy">
              Validé par {{ organizer.entryValidatedBy.firstName }}
              {{ organizer.entryValidatedBy.lastName }}
            </span>
            <span v-else>{{ $t('ticketing.participant.volunteer_validated') }}</span>
            {{
              organizer.entryValidatedAt
                ? `le ${new Date(organizer.entryValidatedAt).toLocaleDateString('fr-FR', {
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

    <!-- Informations de l'organisateur -->
    <TicketingUserInfoSection
      ref="userInfoSection"
      :title="$t('common.organizer')"
      :first-name="editableFirstName"
      :last-name="editableLastName"
      :email="editableEmail"
      :phone="editablePhone"
      :original-email="organizer.user.email"
      :user-id="organizer.user.id"
      @update:first-name="$emit('update:firstName', $event)"
      @update:last-name="$emit('update:lastName', $event)"
      @update:email="$emit('update:email', $event)"
      @update:phone="$emit('update:phone', $event)"
    />

    <!-- Boutons d'action -->
    <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
      <UButton
        :color="organizer.entryValidated ? 'error' : 'success'"
        :icon="organizer.entryValidated ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
        :loading="validating"
        :disabled="!organizer.entryValidated && !isEmailValid"
        @click="organizer.entryValidated ? $emit('invalidate') : $emit('validate')"
      >
        {{ organizer.entryValidated ? "Dévalider l'entrée" : "Valider l'entrée" }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type TicketingUserInfoSection from './TicketingUserInfoSection.vue'

interface Organizer {
  id: number
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
  title?: string | null
  entryValidated?: boolean
  entryValidatedAt?: Date | string
  entryValidatedBy?: {
    firstName: string
    lastName: string
  }
}

defineProps<{
  organizer: Organizer
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
