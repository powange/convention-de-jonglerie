<template>
  <UModal v-model:open="isOpen" :title="$t('pages.volunteers.application_details')">
    <template #body>
      <div v-if="application" class="space-y-6">
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
        <div
          v-if="
            application.setupAvailability ||
            application.eventAvailability ||
            application.teardownAvailability
          "
        >
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
            <span v-if="application.eventAvailability && application.teardownAvailability">, </span>
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

        <!-- Préférences horaires -->
        <div
          v-if="
            application.volunteersSettings?.askTimePreferences &&
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
              v-for="timeSlot in application.timePreferences"
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
            application.volunteersSettings?.askTeamPreferences &&
            application.teamPreferences &&
            Array.isArray(application.teamPreferences) &&
            application.teamPreferences.length > 0
          "
        >
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('pages.volunteers.team_preferences') }}
          </h4>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <span v-for="(team, index) in application.teamPreferences" :key="team">
              {{ team }}<span v-if="index < application.teamPreferences.length - 1">, </span>
            </span>
          </div>
        </div>

        <!-- Préférences alimentaires et allergies -->
        <div
          v-if="
            (application.volunteersSettings?.askDiet && application.dietaryPreference !== 'NONE') ||
            (application.volunteersSettings?.askAllergies && application.allergies)
          "
        >
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('pages.volunteers.dietary_preferences') }}
          </h4>
          <div class="text-sm space-y-1">
            <div
              v-if="
                application.volunteersSettings?.askDiet && application.dietaryPreference !== 'NONE'
              "
            >
              <span class="text-gray-600 dark:text-gray-400"
                >{{ $t('pages.volunteers.diet') }}:</span
              >
              <span class="ml-2">{{
                $t(`pages.volunteers.dietary.${application.dietaryPreference.toLowerCase()}`)
              }}</span>
            </div>
            <div v-if="application.volunteersSettings?.askAllergies && application.allergies">
              <span class="text-gray-600 dark:text-gray-400"
                >{{ $t('pages.volunteers.allergies') }}:</span
              >
              <span class="ml-2">{{ application.allergies }}</span>
            </div>
          </div>
        </div>

        <!-- Contact d'urgence -->
        <div
          v-if="
            (application.volunteersSettings?.askEmergencyContact ||
              (application.volunteersSettings?.askAllergies && application.allergies)) &&
            (application.emergencyContactName || application.emergencyContactPhone)
          "
        >
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('pages.volunteers.emergency_contact') }}
          </h4>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <div v-if="application.emergencyContactName">
              <span class="text-gray-600 dark:text-gray-400"
                >{{ $t('pages.volunteers.emergency_contact_name') }}:</span
              >
              <span class="ml-2">{{ application.emergencyContactName }}</span>
            </div>
            <div v-if="application.emergencyContactPhone" class="mt-1">
              <span class="text-gray-600 dark:text-gray-400"
                >{{ $t('pages.volunteers.emergency_contact_phone') }}:</span
              >
              <span class="ml-2">{{ application.emergencyContactPhone }}</span>
            </div>
          </div>
        </div>

        <!-- Animaux de compagnie -->
        <div v-if="application.volunteersSettings?.askPets && application.hasPets">
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
        <div v-if="application.volunteersSettings?.askMinors && application.hasMinors">
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
        <div v-if="application.volunteersSettings?.askVehicle && application.hasVehicle">
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
        <div v-if="application.volunteersSettings?.askCompanion && application.companionName">
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
        <div v-if="application.volunteersSettings?.askAvoidList && application.avoidList">
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('pages.volunteers.avoid_list') }}
          </h4>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ application.avoidList }}
          </div>
        </div>

        <!-- Compétences -->
        <div v-if="application.volunteersSettings?.askSkills && application.skills">
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
            application.volunteersSettings?.askExperience &&
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
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface ApplicationWithSettings {
  [key: string]: any
  volunteersSettings?: any
}

interface Props {
  modelValue: boolean
  application: ApplicationWithSettings | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { formatDateTimeWithGranularity } = useDateFormat()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>
