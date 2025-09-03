<template>
  <UModal
    v-model:open="showModal"
    :title="t('editions.volunteers_apply')"
    :description="t('editions.volunteers_apply_description')"
    :dismissible="!applying"
    :ui="{ content: 'max-w-xl rounded-none' }"
  >
    <template #body>
      <div class="space-y-4 w-full">
        <!-- Infos personnelles transmises -->
        <div
          class="space-y-2 text-gray-600 dark:text-gray-400 border rounded-md p-3 bg-gray-50 dark:bg-gray-800/40"
        >
          <div class="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
            <UIcon name="i-heroicons-information-circle" class="text-primary-500" />
            <span>{{ t('editions.volunteers_personal_info_notice') }}</span>
          </div>
          <div class="space-y-2 text-[11px] sm:text-xs">
            <!-- Première ligne: Nom et Prénom -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span class="font-semibold">{{ t('editions.volunteers_first_name') }}:</span>
                <span v-if="user?.prenom" class="ml-1">{{ user.prenom }}</span>
                <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
              </div>
              <div>
                <span class="font-semibold">{{ t('editions.volunteers_last_name') }}:</span>
                <span v-if="user?.nom" class="ml-1">{{ user.nom }}</span>
                <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
              </div>
            </div>
            <!-- Deuxième ligne: Email et Téléphone -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span class="font-semibold">{{ t('common.email') }}:</span>
                <span class="ml-1">{{ user?.email }}</span>
              </div>
              <div>
                <span class="font-semibold">{{ t('editions.volunteers_phone') }}:</span>
                <span v-if="user?.phone" class="ml-1">{{ user.phone }}</span>
                <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
              </div>
            </div>
          </div>
          <p class="mt-1 text-[11px] leading-snug">
            {{ t('editions.volunteers_personal_info_disclaimer') }}
          </p>
        </div>

        <!-- Champ téléphone si manquant -->
        <div v-if="needsPhone" class="space-y-2 w-full">
          <UFormField
            :label="t('editions.volunteers_phone_required')"
            :error="phoneError"
            class="w-full"
          >
            <UInput v-model="formData.phone" autocomplete="tel" class="w-full" />
          </UFormField>
        </div>

        <!-- Champs nom/prénom si manquants -->
        <div
          v-if="!user?.prenom || !user?.nom"
          class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
        >
          <UFormField
            v-if="!user?.prenom"
            :label="t('editions.volunteers_first_name_required')"
            :error="firstNameError"
            class="w-full"
          >
            <UInput v-model="formData.firstName" class="w-full" />
          </UFormField>
          <UFormField
            v-if="!user?.nom"
            :label="t('editions.volunteers_last_name_required')"
            :error="lastNameError"
            class="w-full"
          >
            <UInput v-model="formData.lastName" class="w-full" />
          </UFormField>
        </div>

        <!-- Section: Votre présence -->
        <div v-if="volunteersInfo?.mode === 'INTERNAL'" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ t('editions.volunteers_presence_title') }}
          </h3>

          <!-- Disponibilité montage -->
          <div v-if="volunteersInfo?.askSetup" class="space-y-2 w-full">
            <USwitch
              v-model="formData.setupAvailability"
              :label="t('editions.volunteers_setup_availability_label')"
            />
          </div>

          <!-- Disponibilité démontage -->
          <div v-if="volunteersInfo?.askTeardown" class="space-y-2 w-full">
            <USwitch
              v-model="formData.teardownAvailability"
              :label="t('editions.volunteers_teardown_availability_label')"
            />
          </div>

          <!-- Disponibilité pendant l'événement -->
          <div class="space-y-2 w-full">
            <USwitch
              v-model="formData.eventAvailability"
              :label="t('editions.volunteers_event_availability_label')"
            />
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_event_availability_hint') }}
            </p>
          </div>

          <!-- Erreur de disponibilité -->
          <div v-if="availabilityError" class="text-sm text-red-600 dark:text-red-400">
            {{ availabilityError }}
          </div>

          <!-- Sélection arrivée -->
          <div class="space-y-2 w-full">
            <UFormField
              :label="t('editions.volunteers_arrival_time_label')"
              :error="arrivalDateError"
            >
              <USelect
                v-model="formData.arrivalDateTime"
                :items="arrivalDateOptions"
                :placeholder="t('editions.volunteers_select_arrival_placeholder')"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Sélection départ -->
          <div class="space-y-2 w-full">
            <UFormField
              :label="t('editions.volunteers_departure_time_label')"
              :error="departureDateError"
            >
              <USelect
                v-model="formData.departureDateTime"
                :items="departureDateOptions"
                :placeholder="t('editions.volunteers_select_departure_placeholder')"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Section: Comment vous voyez vos créneaux -->
        <div v-if="showPreferencesSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ t('editions.volunteers_shifts_preferences_title') }}
          </h3>

          <!-- Équipes préférées -->
          <div
            v-if="volunteersInfo?.askTeamPreferences && volunteersInfo?.teams?.length"
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers_team_preferences_label')">
              <UCheckboxGroup
                v-model="formData.teamPreferences"
                :items="teamItems"
                class="grid grid-cols-1 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_team_preferences_hint') }}
            </p>
          </div>

          <!-- Créneaux horaires préférés -->
          <div v-if="volunteersInfo?.askTimePreferences" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers_time_preferences_label')">
              <UCheckboxGroup
                v-model="formData.timePreferences"
                :items="timeSlotItems"
                class="grid grid-cols-1 sm:grid-cols-2 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_time_preferences_hint') }}
            </p>
          </div>

          <!-- Bénévoles préférés pour créneaux -->
          <div v-if="volunteersInfo?.askCompanion" class="space-y-2 w-full">
            <UFormField>
              <UTextarea
                v-model="formData.companionName"
                :label="t('editions.volunteers_companion_label')"
                :placeholder="t('editions.volunteers_companion_placeholder')"
                class="w-full"
                :rows="2"
                :maxlength="300"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_companion_hint') }}
            </p>
          </div>

          <!-- Bénévoles à éviter pour créneaux -->
          <div v-if="volunteersInfo?.askAvoidList" class="space-y-2 w-full">
            <UFormField>
              <UTextarea
                v-model="formData.avoidList"
                :label="t('editions.volunteers_avoid_list_label')"
                :placeholder="t('editions.volunteers_avoid_list_placeholder')"
                class="w-full"
                :rows="3"
                :maxlength="500"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_avoid_list_hint') }}
            </p>
          </div>
        </div>

        <!-- Section: Les choses à savoir sur vous -->
        <div v-if="showAboutYouSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ t('editions.volunteers_about_you_title') }}
          </h3>

          <!-- Régime alimentaire -->
          <div v-if="volunteersInfo?.askDiet" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers_diet_label')">
              <USelect
                v-model="formData.dietPreference"
                :items="dietPreferenceItems"
                size="lg"
                class="w-full text-sm"
                :placeholder="t('diet.none')"
              />
            </UFormField>
          </div>

          <!-- Allergies -->
          <div v-if="volunteersInfo?.askAllergies" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers_allergies_label')">
              <UInput
                v-model="formData.allergies"
                :placeholder="t('editions.volunteers_allergies_placeholder')"
                class="w-full"
                :maxlength="300"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">{{ t('editions.volunteers_allergies_hint') }}</p>
          </div>

          <!-- Animaux de compagnie -->
          <div v-if="volunteersInfo?.askPets" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasPets"
                :label="t('editions.volunteers_pets_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasPets" class="ml-8">
              <UFormField :label="t('editions.volunteers_pets_details_label')">
                <UTextarea
                  v-model="formData.petsDetails"
                  :placeholder="t('editions.volunteers_pets_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers_pets_details_hint') }}
              </p>
            </div>
          </div>

          <!-- Personnes mineures -->
          <div v-if="volunteersInfo?.askMinors" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasMinors"
                :label="t('editions.volunteers_minors_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasMinors" class="ml-8">
              <UFormField :label="t('editions.volunteers_minors_details_label')">
                <UTextarea
                  v-model="formData.minorsDetails"
                  :placeholder="t('editions.volunteers_minors_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers_minors_details_hint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Section: Ce que vous pouvez nous apporter -->
        <div v-if="showWhatYouCanBringSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ t('editions.volunteers_what_you_can_bring_title') }}
          </h3>

          <!-- Véhicule à disposition -->
          <div v-if="volunteersInfo?.askVehicle" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasVehicle"
                :label="t('editions.volunteers_vehicle_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasVehicle" class="ml-8">
              <UFormField :label="t('editions.volunteers_vehicle_details_label')">
                <UTextarea
                  v-model="formData.vehicleDetails"
                  :placeholder="t('editions.volunteers_vehicle_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers_vehicle_details_hint') }}
              </p>
            </div>
          </div>

          <!-- Compétences et certifications -->
          <div v-if="volunteersInfo?.askSkills" class="space-y-2 w-full">
            <UFormField>
              <UTextarea
                v-model="formData.skills"
                :label="t('editions.volunteers_skills_label')"
                :placeholder="t('editions.volunteers_skills_placeholder')"
                class="w-full"
                :rows="4"
                :maxlength="1000"
              />
            </UFormField>
            <div class="flex justify-between items-center">
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers_skills_hint') }}
              </p>
              <p class="text-[11px] text-gray-500">{{ formData.skills.length }} / 1000</p>
            </div>
          </div>

          <!-- Expérience bénévolat -->
          <div v-if="volunteersInfo?.askExperience" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasExperience"
                :label="t('editions.volunteers_experience_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasExperience" class="ml-8">
              <UFormField :label="t('editions.volunteers_experience_details_label')">
                <UTextarea
                  v-model="formData.experienceDetails"
                  :placeholder="t('editions.volunteers_experience_details_placeholder')"
                  :rows="3"
                  class="w-full"
                  :maxlength="500"
                />
              </UFormField>
              <div class="flex justify-between items-center">
                <p class="text-[11px] text-gray-500">
                  {{ t('editions.volunteers_experience_details_hint') }}
                </p>
                <p class="text-[11px] text-gray-500">
                  {{ formData.experienceDetails.length }} / 500
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Section: A rajouter -->
        <div class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ t('editions.volunteers_additional_info_title') }}
          </h3>
        </div>

        <!-- Motivation (déplacé en bas) -->
        <UFormField
          :label="t('editions.volunteers_motivation_label')"
          :error="motivationError"
          class="w-full"
        >
          <div class="space-y-1 w-full">
            <UTextarea
              v-model="formData.motivation"
              :rows="5"
              :placeholder="t('editions.volunteers_motivation_placeholder')"
              :maxlength="MOTIVATION_MAX"
              class="w-full"
            />
            <div class="flex justify-end text-xs" :class="{ 'text-red-500': motivationTooLong }">
              {{ formData.motivation.length }} / {{ MOTIVATION_MAX }}
            </div>
          </div>
        </UFormField>
        <p class="text-xs text-gray-500 whitespace-pre-line w-full">
          {{ t('editions.volunteers_motivation_hint', { max: MOTIVATION_MAX }) }}
        </p>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2 w-full">
        <UButton
          size="lg"
          variant="ghost"
          :disabled="applying"
          @click="
            () => {
              close()
              $emit('close')
            }
          "
          >{{ t('common.cancel') }}</UButton
        >
        <UButton
          size="lg"
          color="primary"
          :loading="applying"
          :disabled="applying || !isFormValid"
          icon="i-heroicons-paper-airplane"
          @click="handleSubmit"
        >
          {{ t('editions.volunteers_apply') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface VolunteerInfo {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  askDiet: boolean
  askAllergies: boolean
  askTimePreferences: boolean
  askTeamPreferences: boolean
  askPets: boolean
  askMinors: boolean
  askVehicle: boolean
  askCompanion: boolean
  askAvoidList: boolean
  askSkills: boolean
  askExperience: boolean
  setupStartDate?: string
  teardownEndDate?: string
  askSetup: boolean
  askTeardown: boolean
  teams: Array<{ name: string; slots?: number }>
  myApplication?: any
  counts: any
}

interface User {
  id: string
  email: string
  pseudo: string
  nom?: string
  prenom?: string
  phone?: string
}

interface Props {
  modelValue: boolean
  volunteersInfo: VolunteerInfo | null
  edition: any
  user: User | null
  applying: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'submit', data: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const MOTIVATION_MAX = 2000

// Modal visibility
const showModal = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Form data
const formData = ref({
  phone: '',
  firstName: '',
  lastName: '',
  setupAvailability: false,
  teardownAvailability: false,
  eventAvailability: true,
  arrivalDateTime: undefined as string | undefined,
  departureDateTime: undefined as string | undefined,
  teamPreferences: [] as string[],
  timePreferences: [] as string[],
  companionName: '',
  avoidList: '',
  dietPreference: 'NONE' as 'NONE' | 'VEGETARIAN' | 'VEGAN',
  allergies: '',
  hasPets: false,
  petsDetails: '',
  hasMinors: false,
  minorsDetails: '',
  hasVehicle: false,
  vehicleDetails: '',
  skills: '',
  hasExperience: false,
  experienceDetails: '',
  motivation: '',
})

// Computed properties
const needsPhone = computed(() => !props.user?.phone)
const motivationTooLong = computed(() => formData.value.motivation.length > MOTIVATION_MAX)

// Individual field validation computed properties
const phoneError = computed(() => {
  if (needsPhone.value && !formData.value.phone?.trim()) {
    return t('validation.phone_required')
  }
  return undefined
})

const firstNameError = computed(() => {
  if (!props.user?.prenom && !formData.value.firstName?.trim()) {
    return t('validation.first_name_required')
  }
  return undefined
})

const lastNameError = computed(() => {
  if (!props.user?.nom && !formData.value.lastName?.trim()) {
    return t('validation.last_name_required')
  }
  return undefined
})

const motivationError = computed(() => {
  if (motivationTooLong.value) {
    return t('validation.motivation_too_long', { max: MOTIVATION_MAX })
  }
  return undefined
})

const availabilityError = computed(() => {
  if (
    !formData.value.setupAvailability &&
    !formData.value.teardownAvailability &&
    !formData.value.eventAvailability
  ) {
    return t('validation.at_least_one_availability_required')
  }
  return undefined
})

const arrivalDateError = computed(() => {
  if (
    props.volunteersInfo?.mode === 'INTERNAL' &&
    (formData.value.setupAvailability ||
      formData.value.eventAvailability ||
      formData.value.teardownAvailability) &&
    !formData.value.arrivalDateTime
  ) {
    return t('validation.arrival_date_required')
  }
  return undefined
})

const departureDateError = computed(() => {
  if (
    props.volunteersInfo?.mode === 'INTERNAL' &&
    (formData.value.eventAvailability || formData.value.teardownAvailability) &&
    !formData.value.departureDateTime
  ) {
    return t('validation.departure_date_required')
  }
  return undefined
})

// Global validation computed properties
const validationErrors = computed(() => {
  const errors: (string | undefined)[] = [
    phoneError.value,
    firstNameError.value,
    lastNameError.value,
    motivationError.value,
    availabilityError.value,
    arrivalDateError.value,
    departureDateError.value,
  ]
  return errors.filter(Boolean) as string[]
})

const isFormValid = computed(() => validationErrors.value.length === 0)

const showPreferencesSection = computed(() => {
  return (
    (props.volunteersInfo?.askTimePreferences && props.volunteersInfo?.mode === 'INTERNAL') ||
    (props.volunteersInfo?.askTeamPreferences &&
      props.volunteersInfo?.teams &&
      props.volunteersInfo.teams.length > 0 &&
      props.volunteersInfo?.mode === 'INTERNAL') ||
    props.volunteersInfo?.askCompanion ||
    props.volunteersInfo?.askAvoidList
  )
})

const showAboutYouSection = computed(() => {
  return (
    (props.volunteersInfo?.askDiet && props.volunteersInfo?.mode === 'INTERNAL') ||
    (props.volunteersInfo?.askAllergies && props.volunteersInfo?.mode === 'INTERNAL') ||
    (props.volunteersInfo?.askPets && props.volunteersInfo?.mode === 'INTERNAL') ||
    (props.volunteersInfo?.askMinors && props.volunteersInfo?.mode === 'INTERNAL')
  )
})

const showWhatYouCanBringSection = computed(() => {
  return (
    (props.volunteersInfo?.askVehicle && props.volunteersInfo?.mode === 'INTERNAL') ||
    props.volunteersInfo?.askSkills ||
    props.volunteersInfo?.askExperience
  )
})

// Helper function to generate date options with time granularity
const generateDateTimeOptions = (
  startDate: Date,
  endDate: Date
): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = []
  const currentDate = new Date(startDate)

  const granularities = [
    { key: 'morning', label: t('editions.volunteers_time_granularity.morning') },
    { key: 'noon', label: t('editions.volunteers_time_granularity.noon') },
    { key: 'afternoon', label: t('editions.volunteers_time_granularity.afternoon') },
    { key: 'evening', label: t('editions.volunteers_time_granularity.evening') },
  ]

  while (currentDate <= endDate) {
    const dateStr = currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

    granularities.forEach((granularity) => {
      options.push({
        value: `${currentDate.toISOString().split('T')[0]}_${granularity.key}`,
        label: `${formattedDate} - ${granularity.label}`,
      })
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return options
}

// Date options
const arrivalDateOptions = computed(() => {
  if (!props.edition) return []

  const startDate =
    formData.value.setupAvailability && props.volunteersInfo?.setupStartDate
      ? new Date(props.volunteersInfo.setupStartDate)
      : new Date(props.edition.startDate)

  const endDate =
    formData.value.setupAvailability && props.volunteersInfo?.setupStartDate
      ? new Date(props.edition.startDate)
      : new Date(props.edition.endDate)

  // S'assurer qu'il y a au moins un jour d'options
  if (startDate >= endDate) {
    // Si les dates sont identiques, proposer au moins le jour de début
    return generateDateTimeOptions(startDate, startDate)
  }

  return generateDateTimeOptions(startDate, endDate)
})

const departureDateOptions = computed(() => {
  if (!props.edition) return []

  const startDate =
    formData.value.teardownAvailability && props.volunteersInfo?.teardownEndDate
      ? new Date(props.edition.endDate)
      : new Date(props.edition.startDate)

  const endDate =
    formData.value.teardownAvailability && props.volunteersInfo?.teardownEndDate
      ? new Date(props.volunteersInfo.teardownEndDate)
      : new Date(props.edition.endDate)

  // S'assurer qu'il y a au moins un jour d'options
  if (startDate >= endDate) {
    // Si les dates sont identiques, proposer au moins le jour de fin
    return generateDateTimeOptions(startDate, startDate)
  }

  return generateDateTimeOptions(startDate, endDate)
})

// Items for select/checkbox components
const teamItems = computed(() => {
  if (!props.volunteersInfo?.askTeamPreferences || !props.volunteersInfo?.teams?.length) {
    return []
  }
  return props.volunteersInfo.teams.map((team) => ({
    label: team.name,
    value: team.name,
  }))
})

// Items de créneaux horaires pour UCheckboxGroup
const timeSlotItems = computed(() => [
  { label: t('editions.volunteers_time_slots.early_morning'), value: 'early_morning' },
  { label: t('editions.volunteers_time_slots.morning'), value: 'morning' },
  { label: t('editions.volunteers_time_slots.lunch'), value: 'lunch' },
  { label: t('editions.volunteers_time_slots.early_afternoon'), value: 'early_afternoon' },
  { label: t('editions.volunteers_time_slots.late_afternoon'), value: 'late_afternoon' },
  { label: t('editions.volunteers_time_slots.evening'), value: 'evening' },
  { label: t('editions.volunteers_time_slots.late_evening'), value: 'late_evening' },
  { label: t('editions.volunteers_time_slots.night'), value: 'night' },
])

const dietPreferenceItems = computed<{ value: 'NONE' | 'VEGETARIAN' | 'VEGAN'; label: string }[]>(
  () => [
    { label: t('diet.none'), value: 'NONE' },
    { label: t('diet.vegetarian'), value: 'VEGETARIAN' },
    { label: t('diet.vegan'), value: 'VEGAN' },
  ]
)

// Methods
const handleSubmit = () => {
  emit('submit', formData.value)
}

// Auto-check event availability when neither setup nor teardown is selected
watch(
  [() => formData.value.setupAvailability, () => formData.value.teardownAvailability],
  ([setupAvail, teardownAvail]) => {
    // If neither setup nor teardown is available, auto-check event availability
    if (!setupAvail && !teardownAvail) {
      formData.value.eventAvailability = true
    }
  },
  { immediate: true }
)

// Reset form when modal opens
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      // Reset form data
      Object.assign(formData.value, {
        phone: '',
        firstName: '',
        lastName: '',
        setupAvailability: false,
        teardownAvailability: false,
        eventAvailability: true,
        arrivalDateTime: undefined,
        departureDateTime: undefined,
        teamPreferences: [],
        timePreferences: [],
        companionName: '',
        avoidList: '',
        dietPreference: 'NONE' as 'NONE' | 'VEGETARIAN' | 'VEGAN',
        allergies: '',
        hasPets: false,
        petsDetails: '',
        hasMinors: false,
        minorsDetails: '',
        hasVehicle: false,
        vehicleDetails: '',
        skills: '',
        hasExperience: false,
        experienceDetails: '',
        motivation: '',
      })
    }
  }
)
</script>
