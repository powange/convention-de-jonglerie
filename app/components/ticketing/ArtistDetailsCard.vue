<template>
  <div class="space-y-6">
    <!-- Badge artiste -->
    <div
      class="flex items-center justify-between p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20"
    >
      <div>
        <p class="text-sm text-yellow-600 dark:text-yellow-400">
          {{ $t('edition.ticketing.access_type') }}
        </p>
        <p class="text-lg font-semibold text-gray-900 dark:text-white">Artiste</p>
      </div>
      <UBadge color="warning" variant="soft" size="lg"> Artiste invité </UBadge>
    </div>

    <!-- Statut de validation d'entrée -->
    <div
      v-if="artist.entryValidated"
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
            <span v-if="artist.entryValidatedBy">
              Validé par {{ artist.entryValidatedBy.firstName }}
              {{ artist.entryValidatedBy.lastName }}
            </span>
            <span v-else>Entrée validée</span>
            {{
              artist.entryValidatedAt
                ? `le ${new Date(artist.entryValidatedAt).toLocaleDateString('fr-FR', {
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

    <!-- Informations de l'artiste -->
    <TicketingUserInfoSection
      ref="userInfoSection"
      title="Artiste"
      :first-name="editableFirstName"
      :last-name="editableLastName"
      :email="editableEmail"
      :phone="editablePhone"
      :original-email="artist.user.email"
      :user-id="artist.user.id"
      @update:first-name="$emit('update:firstName', $event)"
      @update:last-name="$emit('update:lastName', $event)"
      @update:email="$emit('update:email', $event)"
      @update:phone="$emit('update:phone', $event)"
    />

    <!-- Spectacles assignés -->
    <div class="space-y-4">
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
        <h4 class="font-semibold text-gray-900 dark:text-white">Spectacles</h4>
      </div>

      <div v-if="artist.shows && artist.shows.length > 0" class="space-y-2">
        <div
          v-for="show in artist.shows"
          :key="show.id"
          class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ show.title }}
              </span>
            </div>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400 ml-6">
            {{
              new Date(show.startDateTime).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            }}
            <span v-if="show.location"> - {{ show.location }}</span>
          </div>
        </div>
      </div>

      <!-- Message si aucun spectacle -->
      <div
        v-else
        class="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg"
      >
        <UIcon name="i-heroicons-star" class="mx-auto h-8 w-8 mb-2 text-gray-400" />
        <p class="text-sm">Aucun spectacle assigné</p>
      </div>
    </div>

    <!-- Repas de l'artiste -->
    <TicketingMealsDisplaySection :meals="artist.meals" />

    <!-- Boutons d'action -->
    <div v-if="!artist.entryValidated || artist.entryValidated" class="flex gap-2 pt-4">
      <UButton
        v-if="!artist.entryValidated"
        color="success"
        icon="i-heroicons-check-circle"
        :loading="validating"
        :disabled="!isEmailValid"
        block
        @click="$emit('validate')"
      >
        Valider l'entrée
      </UButton>
      <UButton
        v-else
        color="error"
        icon="i-heroicons-x-circle"
        :loading="validating"
        block
        @click="$emit('invalidate')"
      >
        Dévalider l'entrée
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type TicketingUserInfoSection from './TicketingUserInfoSection.vue'

interface Artist {
  id: number
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
  shows: Array<{
    id: number
    title: string
    startDateTime: Date | string
    location?: string
  }>
  returnableItems?: Array<{
    id: number
    name: string
  }>
  meals?: Array<{
    id: number
    date: Date | string
    mealType: string
    phase: string
  }>
  entryValidated?: boolean
  entryValidatedAt?: Date | string
  entryValidatedBy?: {
    firstName: string
    lastName: string
  }
}

defineProps<{
  artist: Artist
  editableFirstName: string | null
  editableLastName: string | null
  editableEmail: string | null
  editablePhone: string | null
  validating: boolean
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

// Computed pour vérifier si l'email est valide en accédant à emailInput via userInfoSection
const isEmailValid = computed(() => {
  return userInfoSection.value?.emailInput?.emailValidation?.isValid ?? true
})
</script>
