<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- En-tête -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('pages.volunteers.my_applications') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ $t('pages.volunteers.applications_description') }}
        </p>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ error.message || $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Liste des candidatures -->
    <div v-else-if="applications && applications.length > 0" class="space-y-6">
      <UCard
        v-for="application in applications"
        :key="application.id"
        class="hover:shadow-lg transition-shadow"
      >
        <template #header>
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <!-- Logo de la convention ou image de l'édition -->
              <div class="flex-shrink-0">
                <img
                  v-if="application.edition.imageUrl"
                  :src="
                    getImageUrl(application.edition.imageUrl, 'edition', application.edition.id) ||
                    ''
                  "
                  :alt="getEditionDisplayName(application.edition)"
                  class="w-16 h-16 object-cover rounded-lg"
                />
                <img
                  v-else-if="application.edition.convention.logo"
                  :src="
                    getImageUrl(
                      application.edition.convention.logo,
                      'convention',
                      application.edition.convention.id
                    ) || ''
                  "
                  :alt="application.edition.convention.name"
                  class="w-16 h-16 object-cover rounded-lg"
                />
                <div
                  v-else
                  class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-calendar-days" class="text-gray-400" size="24" />
                </div>
              </div>

              <div class="flex-1">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ getEditionDisplayName(application.edition) }}
                </h3>
                <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                  <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                  {{ application.edition.city }}, {{ application.edition.country }}
                </p>
                <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                  <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                  {{ formatDateRange(application.edition.startDate, application.edition.endDate) }}
                </p>
              </div>
            </div>

            <div class="flex flex-col items-end gap-2">
              <UBadge
                :color="getStatusColor(application.status)"
                :variant="getStatusVariant(application.status)"
              >
                {{ $t(`editions.volunteers.status.${application.status.toLowerCase()}`) }}
              </UBadge>

              <!-- Équipes assignées dans le header -->
              <div
                v-if="
                  application.status === 'ACCEPTED' &&
                  application.assignedTeams &&
                  Array.isArray(application.assignedTeams) &&
                  application.assignedTeams.length > 0
                "
                class="flex flex-wrap gap-1 justify-end"
              >
                <UBadge
                  v-for="team in application.assignedTeams as string[]"
                  :key="team"
                  color="info"
                  variant="solid"
                >
                  {{ team }}
                </UBadge>
              </div>

              <span class="text-sm text-gray-500">
                {{ $t('pages.volunteers.applied_on') }} {{ formatDate(application.createdAt) }}
              </span>
            </div>
          </div>
        </template>

        <!-- Détails de la candidature -->
        <div class="space-y-4">
          <!-- Motivation -->
          <div v-if="application.motivation">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.motivation') }}
            </h4>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ application.motivation }}
            </p>
          </div>

          <!-- Disponibilités -->
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.availability') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span v-if="application.setupAvailability">{{ $t('pages.volunteers.setup') }}</span>
              <span
                v-if="
                  application.setupAvailability &&
                  (application.eventAvailability || application.teardownAvailability)
                "
                >,
              </span>
              <span v-if="application.eventAvailability">{{ $t('pages.volunteers.event') }}</span>
              <span v-if="application.eventAvailability && application.teardownAvailability"
                >,
              </span>
              <span v-if="application.teardownAvailability">{{
                $t('pages.volunteers.teardown')
              }}</span>
            </div>
          </div>

          <!-- Dates d'arrivée/départ -->
          <div v-if="application.arrivalDateTime || application.departureDateTime">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.dates') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span v-if="application.arrivalDateTime">
                {{ formatDateTimeWithGranularity(application.arrivalDateTime) }}
              </span>
              <UIcon
                v-if="application.arrivalDateTime && application.departureDateTime"
                name="i-heroicons-arrow-right"
                class="text-gray-400"
                size="16"
              />
              <span v-if="application.departureDateTime">
                {{ formatDateTimeWithGranularity(application.departureDateTime) }}
              </span>
            </div>
          </div>

          <!-- Préférences alimentaires et allergies -->
          <div
            v-if="
              (application.edition.volunteersAskDiet && application.dietaryPreference !== 'NONE') ||
              (application.edition.volunteersAskAllergies && application.allergies)
            "
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.dietary_preferences') }}
            </h4>
            <div class="text-sm space-y-1">
              <div
                v-if="
                  application.edition.volunteersAskDiet && application.dietaryPreference !== 'NONE'
                "
              >
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.diet') }}:</span
                >
                <span class="ml-2">{{
                  $t(`pages.volunteers.dietary.${application.dietaryPreference.toLowerCase()}`)
                }}</span>
              </div>
              <div v-if="application.edition.volunteersAskAllergies && application.allergies">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.allergies') }}:</span
                >
                <span class="ml-2">{{ application.allergies }}</span>
              </div>
            </div>
          </div>

          <!-- Préférences horaires -->
          <div
            v-if="
              application.edition.volunteersAskTimePreferences &&
              application.timePreferences &&
              Array.isArray(application.timePreferences) &&
              application.timePreferences.length > 0
            "
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.time_preferences') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="timeSlot in application.timePreferences as string[]"
                :key="timeSlot"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ $t(`editions.volunteers.time_slots_options.${timeSlot}`) }}
              </UBadge>
            </div>
          </div>

          <!-- Préférences d'équipes -->
          <div
            v-if="
              application.edition.volunteersAskTeamPreferences &&
              application.teamPreferences &&
              Array.isArray(application.teamPreferences) &&
              application.teamPreferences.length > 0
            "
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.team_preferences') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span v-for="(team, index) in application.teamPreferences as string[]" :key="team">
                {{ team }}<span v-if="index < application.teamPreferences.length - 1">, </span>
              </span>
            </div>
          </div>

          <!-- Animaux de compagnie -->
          <div v-if="application.edition.volunteersAskPets && application.hasPets">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.pets') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.has_pets') }}:</span
                >
                <span class="ml-2">{{ $t('common.yes') }}</span>
              </div>
              <div v-if="application.petsDetails" class="mt-1">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.pets_details') }}:</span
                >
                <span class="ml-2">{{ application.petsDetails }}</span>
              </div>
            </div>
          </div>

          <!-- Personnes mineures -->
          <div v-if="application.edition.volunteersAskMinors && application.hasMinors">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.minors') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.has_minors') }}:</span
                >
                <span class="ml-2">{{ $t('common.yes') }}</span>
              </div>
              <div v-if="application.minorsDetails" class="mt-1">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.minors_details') }}:</span
                >
                <span class="ml-2">{{ application.minorsDetails }}</span>
              </div>
            </div>
          </div>

          <!-- Véhicule -->
          <div v-if="application.edition.volunteersAskVehicle && application.hasVehicle">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.vehicle') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.has_vehicle') }}:</span
                >
                <span class="ml-2">{{ $t('common.yes') }}</span>
              </div>
              <div v-if="application.vehicleDetails" class="mt-1">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.vehicle_details') }}:</span
                >
                <span class="ml-2">{{ application.vehicleDetails }}</span>
              </div>
            </div>
          </div>

          <!-- Compagnon -->
          <div v-if="application.edition.volunteersAskCompanion && application.companionName">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.companion') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span class="text-gray-600 dark:text-gray-400"
                >{{ $t('pages.volunteers.companion_name') }}:</span
              >
              <span class="ml-2">{{ application.companionName }}</span>
            </div>
          </div>

          <!-- Liste à éviter -->
          <div v-if="application.edition.volunteersAskAvoidList && application.avoidList">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.avoid_list') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ application.avoidList }}
            </div>
          </div>

          <!-- Compétences -->
          <div v-if="application.edition.volunteersAskSkills && application.skills">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.skills') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ application.skills }}
            </div>
          </div>

          <!-- Expérience -->
          <div
            v-if="
              application.edition.volunteersAskExperience &&
              (application.hasExperience || application.experienceDetails)
            "
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('pages.volunteers.experience') }}
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <div v-if="application.hasExperience !== null">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.has_experience') }}:</span
                >
                <span class="ml-2">{{
                  application.hasExperience ? $t('common.yes') : $t('common.no')
                }}</span>
              </div>
              <div v-if="application.experienceDetails" class="mt-1">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.experience_details') }}:</span
                >
                <span class="ml-2">{{ application.experienceDetails }}</span>
              </div>
            </div>
          </div>

          <!-- Créneaux assignés -->
          <div
            v-if="
              application.status === 'ACCEPTED' &&
              application.assignedTimeSlots &&
              application.assignedTimeSlots.length > 0
            "
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="text-blue-600 dark:text-blue-400" />
              {{ $t('pages.volunteers.assigned_time_slots') }}
              <UBadge color="blue" variant="soft" size="sm">
                {{ application.assignedTimeSlots.length }}
              </UBadge>
            </h4>
            <div class="space-y-3">
              <div
                v-for="assignment in application.assignedTimeSlots"
                :key="assignment.id"
                class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">
                      {{ assignment.timeSlot.title || $t('pages.volunteers.unnamed_slot') }}
                    </p>
                    <div
                      class="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 mb-2"
                    >
                      <UIcon name="i-heroicons-calendar-days" class="w-3 h-3" />
                      <span>
                        {{
                          formatSlotDateTime(
                            assignment.timeSlot.startDateTime,
                            assignment.timeSlot.endDateTime
                          )
                        }}
                      </span>
                    </div>
                    <div v-if="assignment.timeSlot.team" class="flex items-center gap-2">
                      <div
                        class="w-2 h-2 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: assignment.timeSlot.team.color || '#6b7280' }"
                      ></div>
                      <span class="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {{ assignment.timeSlot.team.name }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-2 text-xs text-blue-600 dark:text-blue-400">
              {{ $t('pages.volunteers.total_hours') }}:
              {{ calculateTotalHours(application.assignedTimeSlots) }}h
            </div>
          </div>

          <!-- Note d'acceptation -->
          <div
            v-if="application.status === 'ACCEPTED' && application.acceptanceNote"
            class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
          >
            <h4 class="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="text-green-600 dark:text-green-400" />
              {{ $t('editions.volunteers.acceptance_note_title') }}
            </h4>
            <p class="text-sm text-green-700 dark:text-green-300">
              {{ application.acceptanceNote }}
            </p>
          </div>
        </div>

        <!-- Actions -->
        <template #footer>
          <div class="flex justify-between items-center">
            <div class="flex gap-2">
              <UButton
                :to="`/editions/${application.edition.id}`"
                size="sm"
                color="primary"
                variant="outline"
                icon="i-heroicons-eye"
              >
                {{ $t('pages.volunteers.view_edition') }}
              </UButton>
            </div>

            <div v-if="application.status === 'PENDING'" class="flex gap-2">
              <UButton
                size="sm"
                color="error"
                variant="ghost"
                icon="i-heroicons-trash"
                @click="withdrawApplication(application.id)"
              >
                {{ $t('pages.volunteers.withdraw') }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <!-- État vide -->
    <div v-else class="text-center py-12">
      <UIcon name="i-heroicons-hand-raised" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('pages.volunteers.no_applications') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('pages.volunteers.no_applications_description') }}
      </p>
      <UButton to="/" color="primary" icon="i-heroicons-magnifying-glass">
        {{ $t('pages.volunteers.browse_conventions') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth-protected',
})

const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const { formatDateTimeWithGranularity } = useDateFormat()
const toast = useToast()

// Récupération des candidatures
const {
  data: applications,
  pending,
  error,
  refresh,
} = await useFetch('/api/user/volunteer-applications')

// Fonctions utilitaires
const getEditionDisplayName = (edition: any) => {
  return edition.name || edition.convention.name
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const endStr = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'ACCEPTED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'WITHDRAWN':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ACCEPTED':
      return 'solid'
    case 'REJECTED':
      return 'solid'
    default:
      return 'soft'
  }
}

// Fonction pour formater les dates et heures des créneaux
const formatSlotDateTime = (startDateTime: string, endDateTime: string) => {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)

  const dateStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const startTimeStr = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const endTimeStr = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${dateStr} • ${startTimeStr} - ${endTimeStr}`
}

// Fonction pour calculer le total d'heures
const calculateTotalHours = (assignments: any[]) => {
  let totalMs = 0

  assignments.forEach((assignment) => {
    const start = new Date(assignment.timeSlot.startDateTime)
    const end = new Date(assignment.timeSlot.endDateTime)
    totalMs += end.getTime() - start.getTime()
  })

  const totalHours = totalMs / (1000 * 60 * 60)
  return totalHours.toFixed(1)
}

// Fonction pour retirer une candidature
const withdrawApplication = async (applicationId: number) => {
  if (!confirm(t('pages.volunteers.confirm_withdraw'))) {
    return
  }

  try {
    // Pour l'instant, on peut utiliser l'API de suppression existante
    // Il faudrait idéalement créer une API spécifique pour le retrait
    await $fetch(
      `/api/editions/${applications.value?.find((app) => app.id === applicationId)?.edition.id}/volunteers/apply`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('pages.volunteers.withdrawal_success'),
      color: 'success',
    })

    // Rafraîchir la liste
    await refresh()
  } catch (error: any) {
    console.error('Erreur lors du retrait:', error)
    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('pages.volunteers.withdrawal_error'),
      color: 'error',
    })
  }
}

// SEO
useSeoMeta({
  title: t('pages.volunteers.my_applications'),
  description: t('pages.volunteers.applications_description'),
})
</script>
