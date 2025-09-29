<template>
  <UModal
    v-if="volunteersInfo?.mode === 'INTERNAL'"
    v-model:open="showModal"
    :title="
      props.isEditing ? t('editions.volunteers.edit_application') : t('editions.volunteers.apply')
    "
    :description="
      props.isEditing
        ? t('editions.volunteers.edit_application_description')
        : t('editions.volunteers.apply_description')
    "
    :dismissible="!applying"
    :ui="{ content: 'max-w-xl rounded-none' }"
  >
    <template #body>
      <div class="space-y-4 w-full">
        <!-- Section: Vos informations personnelles -->
        <div class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ personalInfoTitle }}
          </h3>

          <!-- Champs nom/prénom (toujours affichés) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <UFormField
              :label="t('editions.volunteers.first_name')"
              :error="firstNameError"
              class="w-full"
            >
              <UInput
                v-model="formData.firstName"
                :placeholder="user?.prenom || t('editions.volunteers.first_name_placeholder')"
                :readonly="isOrganizerEditingApplication"
                :disabled="isOrganizerEditingApplication"
                :class="[
                  'w-full',
                  isOrganizerEditingApplication ? 'bg-gray-50 dark:bg-gray-800' : '',
                ]"
                @blur="markFieldTouched('firstName')"
              />
            </UFormField>
            <UFormField
              :label="t('editions.volunteers.last_name')"
              :error="lastNameError"
              class="w-full"
            >
              <UInput
                v-model="formData.lastName"
                :placeholder="user?.nom || t('editions.volunteers.last_name_placeholder')"
                :readonly="isOrganizerEditingApplication"
                :disabled="isOrganizerEditingApplication"
                :class="[
                  'w-full',
                  isOrganizerEditingApplication ? 'bg-gray-50 dark:bg-gray-800' : '',
                ]"
                @blur="markFieldTouched('lastName')"
              />
            </UFormField>
          </div>

          <!-- Champ email (lecture seule) -->
          <div class="w-full">
            <UFormField :label="t('common.email')" class="w-full">
              <UInput
                :value="user?.email"
                readonly
                disabled
                class="w-full bg-gray-50 dark:bg-gray-800"
              />
            </UFormField>
          </div>

          <!-- Champ téléphone (toujours affiché) -->
          <div class="w-full">
            <UFormField :label="t('editions.volunteers.phone')" :error="phoneError" class="w-full">
              <UInput
                v-model="formData.phone"
                :placeholder="user?.phone || t('editions.volunteers.phone_placeholder')"
                autocomplete="tel"
                :readonly="isOrganizerEditingApplication"
                :disabled="isOrganizerEditingApplication"
                :class="[
                  'w-full',
                  isOrganizerEditingApplication ? 'bg-gray-50 dark:bg-gray-800' : '',
                ]"
                @blur="markFieldTouched('phone')"
              />
            </UFormField>
          </div>

          <p class="text-xs text-gray-500">
            {{ t('editions.volunteers.personal_info_disclaimer') }}
          </p>
        </div>

        <!-- Section: Votre présence -->
        <div class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ presenceTitle }}
          </h3>

          <!-- Disponibilité montage -->
          <div v-if="volunteersInfo?.askSetup" class="space-y-2 w-full">
            <USwitch
              v-model="formData.setupAvailability"
              :label="t('editions.volunteers.setup_availability_label')"
              @change="markFieldTouched('availability')"
            />
          </div>

          <!-- Disponibilité démontage -->
          <div v-if="volunteersInfo?.askTeardown" class="space-y-2 w-full">
            <USwitch
              v-model="formData.teardownAvailability"
              :label="t('editions.volunteers.teardown_availability_label')"
              @change="markFieldTouched('availability')"
            />
          </div>

          <!-- Disponibilité pendant l'événement -->
          <div class="space-y-2 w-full">
            <USwitch
              v-model="formData.eventAvailability"
              :label="t('editions.volunteers.event_availability_label')"
              @change="markFieldTouched('availability')"
            />
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers.event_availability_hint') }}
            </p>
          </div>

          <!-- Erreur de disponibilité -->
          <div v-if="availabilityError" class="text-sm text-red-600 dark:text-red-400">
            {{ availabilityError }}
          </div>

          <!-- Sélection arrivée -->
          <div class="space-y-2 w-full">
            <UFormField
              :label="t('editions.volunteers.arrival_time_label')"
              :error="arrivalDateError"
            >
              <USelect
                v-model="formData.arrivalDateTime"
                :items="arrivalDateOptions"
                :placeholder="t('editions.volunteers.select_arrival_placeholder')"
                class="w-full"
                @change="markFieldTouched('arrivalDateTime')"
              />
            </UFormField>
          </div>

          <!-- Sélection départ -->
          <div class="space-y-2 w-full">
            <UFormField
              :label="t('editions.volunteers.departure_time_label')"
              :error="departureDateError"
            >
              <USelect
                v-model="formData.departureDateTime"
                :items="departureDateOptions"
                :placeholder="t('editions.volunteers.select_departure_placeholder')"
                class="w-full"
                @change="markFieldTouched('departureDateTime')"
              />
            </UFormField>
          </div>
        </div>

        <!-- Section: Comment vous voyez vos créneaux -->
        <div v-if="showPreferencesSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ shiftsPreferencesTitle }}
          </h3>

          <!-- Équipes préférées -->
          <div
            v-if="volunteersInfo?.askTeamPreferences && volunteerTeams.length"
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers.team_preferences_label')">
              <UCheckboxGroup
                v-model="formData.teamPreferences"
                :items="teamItems"
                class="grid grid-cols-1 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers.team_preferences_hint') }}
            </p>
          </div>

          <!-- Créneaux horaires préférés -->
          <div v-if="volunteersInfo?.askTimePreferences" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers.time_preferences_label')">
              <UCheckboxGroup
                v-model="formData.timePreferences"
                :items="timeSlotItems"
                class="grid grid-cols-1 sm:grid-cols-2 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers.time_preferences_hint') }}
            </p>
          </div>

          <!-- Bénévoles préférés pour créneaux -->
          <div v-if="volunteersInfo?.askCompanion" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers.companion_label')">
              <UTextarea
                v-model="formData.companionName"
                :placeholder="t('editions.volunteers.companion_placeholder')"
                class="w-full"
                :rows="2"
                :maxlength="300"
                @blur="markFieldTouched('companionName')"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers.companion_hint') }}
            </p>
          </div>

          <!-- Bénévoles à éviter pour créneaux -->
          <div v-if="volunteersInfo?.askAvoidList" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers.avoid_list_label')">
              <UTextarea
                v-model="formData.avoidList"
                :placeholder="t('editions.volunteers.avoid_list_placeholder')"
                class="w-full"
                :rows="3"
                :maxlength="500"
                @blur="markFieldTouched('avoidList')"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers.avoid_list_hint') }}
            </p>
          </div>
        </div>

        <!-- Section: Les choses à savoir sur vous -->
        <div v-if="showAboutYouSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ aboutYouTitle }}
          </h3>

          <!-- Régime alimentaire -->
          <div v-if="volunteersInfo?.askDiet" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers.diet_label')">
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
            <UFormField :label="t('editions.volunteers.allergies_label')">
              <UInput
                v-model="formData.allergies"
                :placeholder="t('editions.volunteers.allergies_placeholder')"
                class="w-full"
                :maxlength="300"
                @change="handleAllergiesChange"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">{{ t('editions.volunteers.allergies_hint') }}</p>

            <!-- Sévérité des allergies -->
            <div v-if="formData.allergies?.trim()" class="mt-3">
              <UFormField
                :label="t('editions.volunteers.allergy_severity_label')"
                :required="true"
                :error="allergySeverityError"
              >
                <USelect
                  v-model="formData.allergySeverity"
                  :items="allergySeverityOptions"
                  :placeholder="t('editions.volunteers.allergy_severity_placeholder')"
                  class="w-full"
                />
              </UFormField>
              <p
                v-if="formData.allergySeverity"
                class="mt-1 px-2 py-1 text-sm rounded"
                :class="allergySeverityDescriptionClass"
              >
                {{
                  formData.allergySeverity
                    ? t(getAllergySeverityDescriptionKey(formData.allergySeverity))
                    : ''
                }}
              </p>
            </div>
          </div>

          <!-- Contact d'urgence -->
          <div v-if="shouldAskEmergencyContact" class="space-y-3 w-full">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ emergencyContactTitle }}
              <span
                v-if="
                  !volunteersInfo?.askEmergencyContact &&
                  formData.allergySeverity &&
                  requiresEmergencyContact(formData.allergySeverity)
                "
                class="text-orange-600 dark:text-orange-400 text-xs font-normal"
              >
                ({{ t('editions.volunteers.emergency_contact_required_for_allergies') }})
              </span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <UFormField
                :label="t('editions.volunteers.emergency_contact_name')"
                :error="emergencyContactNameError"
                class="w-full"
              >
                <UInput
                  v-model="formData.emergencyContactName"
                  :placeholder="t('editions.volunteers.emergency_contact_name_placeholder')"
                  class="w-full"
                  @blur="markFieldTouched('emergencyContactName')"
                />
              </UFormField>
              <UFormField
                :label="t('editions.volunteers.emergency_contact_phone')"
                :error="emergencyContactPhoneError"
                class="w-full"
              >
                <UInput
                  v-model="formData.emergencyContactPhone"
                  :placeholder="t('editions.volunteers.emergency_contact_phone_placeholder')"
                  autocomplete="tel"
                  class="w-full"
                  @blur="markFieldTouched('emergencyContactPhone')"
                />
              </UFormField>
            </div>
            <p class="text-xs text-gray-500">
              {{ t('editions.volunteers.emergency_contact_hint') }}
            </p>
          </div>

          <!-- Animaux de compagnie -->
          <div v-if="volunteersInfo?.askPets" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasPets"
                :label="t('editions.volunteers.pets_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasPets" class="ml-8">
              <UFormField :label="t('editions.volunteers.pets_details_label')">
                <UTextarea
                  v-model="formData.petsDetails"
                  :placeholder="t('editions.volunteers.pets_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers.pets_details_hint') }}
              </p>
            </div>
          </div>

          <!-- Personnes mineures -->
          <div v-if="volunteersInfo?.askMinors" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasMinors"
                :label="t('editions.volunteers.minors_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasMinors" class="ml-8">
              <UFormField :label="t('editions.volunteers.minors_details_label')">
                <UTextarea
                  v-model="formData.minorsDetails"
                  :placeholder="t('editions.volunteers.minors_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers.minors_details_hint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Section: Ce que vous pouvez nous apporter -->
        <div v-if="showWhatYouCanBringSection" class="space-y-4 w-full">
          <h3
            class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            {{ whatYouCanBringTitle }}
          </h3>

          <!-- Véhicule à disposition -->
          <div v-if="volunteersInfo?.askVehicle" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasVehicle"
                :label="t('editions.volunteers.vehicle_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasVehicle" class="ml-8">
              <UFormField :label="t('editions.volunteers.vehicle_details_label')">
                <UTextarea
                  v-model="formData.vehicleDetails"
                  :placeholder="t('editions.volunteers.vehicle_details_placeholder')"
                  :rows="2"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers.vehicle_details_hint') }}
              </p>
            </div>
          </div>

          <!-- Compétences et certifications -->
          <div v-if="volunteersInfo?.askSkills" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers.skills_label')">
              <UTextarea
                v-model="formData.skills"
                :placeholder="t('editions.volunteers.skills_placeholder')"
                class="w-full"
                :rows="4"
                :maxlength="1000"
                @blur="markFieldTouched('skills')"
              />
            </UFormField>
            <div class="flex justify-between items-center">
              <p class="text-[11px] text-gray-500">
                {{ t('editions.volunteers.skills_hint') }}
              </p>
              <p class="text-[11px] text-gray-500">{{ formData.skills.length }} / 1000</p>
            </div>
          </div>

          <!-- Expérience bénévolat -->
          <div v-if="volunteersInfo?.askExperience" class="space-y-2 w-full">
            <UFormField>
              <USwitch
                v-model="formData.hasExperience"
                :label="t('editions.volunteers.experience_label')"
                size="lg"
              />
            </UFormField>
            <div v-if="formData.hasExperience" class="ml-8">
              <UFormField :label="t('editions.volunteers.experience_details_label')">
                <UTextarea
                  v-model="formData.experienceDetails"
                  :placeholder="t('editions.volunteers.experience_details_placeholder')"
                  :rows="3"
                  class="w-full"
                  :maxlength="500"
                />
              </UFormField>
              <div class="flex justify-between items-center">
                <p class="text-[11px] text-gray-500">
                  {{ t('editions.volunteers.experience_details_hint') }}
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
            {{ additionalInfoTitle }}
          </h3>
        </div>

        <!-- Motivation (déplacé en bas) -->
        <UFormField
          :label="t('editions.volunteers.motivation_label')"
          :error="motivationError"
          class="w-full"
        >
          <div class="space-y-1 w-full">
            <UTextarea
              v-model="formData.motivation"
              :rows="5"
              :placeholder="t('editions.volunteers.motivation_placeholder')"
              :maxlength="MOTIVATION_MAX"
              class="w-full"
              @blur="markFieldTouched('motivation')"
            />
            <div class="flex justify-end text-xs" :class="{ 'text-red-500': motivationTooLong }">
              {{ formData.motivation.length }} / {{ MOTIVATION_MAX }}
            </div>
          </div>
        </UFormField>
        <p class="text-xs text-gray-500 whitespace-pre-line w-full">
          {{ t('editions.volunteers.motivation_hint', { max: MOTIVATION_MAX }) }}
        </p>
      </div>

      <!-- Section: Ajout de l'organisateur (seulement si c'est un orga qui édite) -->
      <div v-if="isOrganizerEditingApplication" class="space-y-4 w-full">
        <h3
          class="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2"
        >
          {{ t('editions.volunteers.organizer_addition_title') }}
        </h3>

        <!-- Note de modification -->
        <UFormField
          :label="t('editions.volunteers.modification_note')"
          :help="t('editions.volunteers.modification_note_help')"
        >
          <UTextarea
            v-model="formData.modificationNote"
            :rows="3"
            :placeholder="t('editions.volunteers.modification_note_placeholder')"
            :maxlength="500"
            class="w-full"
          />
          <div class="text-xs text-gray-500 mt-1 text-right">
            {{ formData.modificationNote.length }}/500
          </div>
        </UFormField>
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
          {{ props.isEditing ? t('common.save') : t('editions.volunteers.apply') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import {
  requiresEmergencyContact,
  getAllergySeverityOptions,
  getAllergySeverityDescriptionKey,
  type AllergySeverityLevel,
} from '~/utils/allergy-severity'

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
  askEmergencyContact: boolean
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
  // Mode édition
  isEditing?: boolean
  existingApplication?: any | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'submit' | 'update', data: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const authStore = useAuthStore()
const { teams: volunteerTeams } = useVolunteerTeams(props.edition.id)

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
  allergySeverity: undefined as AllergySeverityLevel | undefined,
  emergencyContactName: '',
  emergencyContactPhone: '',
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
  modificationNote: '',
})

// Système de suivi des champs touchés
const touchedFields = ref(new Set<string>())
const showAllErrors = ref(false)

// Computed properties
const motivationTooLong = computed(() => formData.value.motivation.length > MOTIVATION_MAX)

// Détermine si c'est un organisateur qui édite (pas le bénévole lui-même)
const isOrganizerEditingApplication = computed(() => {
  if (!props.isEditing) return false
  if (!authStore.user) return false
  if (!props.existingApplication) return false
  // Si l'utilisateur connecté n'est pas le propriétaire de la candidature
  return authStore.user.id !== props.existingApplication.user.id
})

// Titres conditionnels selon si c'est un organisateur ou l'utilisateur qui édite
const personalInfoTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_about_you_title')
    : t('editions.volunteers.personal_info_title')
)

const presenceTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_presence_title')
    : t('editions.volunteers.presence_title')
)

const shiftsPreferencesTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_shifts_preferences_title')
    : t('editions.volunteers.shifts_preferences_title')
)

const whatYouCanBringTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_what_you_can_bring_title')
    : t('editions.volunteers.what_you_can_bring_title')
)

const aboutYouTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_about_you_title')
    : t('editions.volunteers.about_you_title')
)

const emergencyContactTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_emergency_contact_title')
    : t('editions.volunteers.emergency_contact_title')
)

const additionalInfoTitle = computed(() =>
  isOrganizerEditingApplication.value
    ? t('editions.volunteers.config_additional_info_title')
    : t('editions.volunteers.additional_info_title')
)

// Fonction pour marquer un champ comme touché
const markFieldTouched = (fieldName: string) => {
  touchedFields.value.add(fieldName)
}

// Individual field validation computed properties
const phoneError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('phone')) return undefined
  if (!formData.value.phone?.trim()) {
    return t('validation.phone_required')
  }
  return undefined
})

const firstNameError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('firstName')) return undefined
  if (!formData.value.firstName?.trim()) {
    return t('validation.first_name_required')
  }
  return undefined
})

const lastNameError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('lastName')) return undefined
  if (!formData.value.lastName?.trim()) {
    return t('validation.last_name_required')
  }
  return undefined
})

const motivationError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('motivation')) return undefined
  if (motivationTooLong.value) {
    return t('validation.motivation_too_long', { max: MOTIVATION_MAX })
  }
  return undefined
})

const availabilityError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('availability')) return undefined
  if (
    !formData.value.setupAvailability &&
    !formData.value.teardownAvailability &&
    !formData.value.eventAvailability
  ) {
    return t('validation.at_least_one_availability_required')
  }
  return undefined
})

const allergySeverityError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('allergySeverity')) return undefined
  if (formData.value.allergies?.trim() && !formData.value.allergySeverity) {
    return t('validation.allergy_severity_required')
  }
  return undefined
})

const allergySeverityOptions = computed(() =>
  getAllergySeverityOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

const allergySeverityDescriptionClass = computed(() => {
  if (!formData.value.allergySeverity) return 'text-gray-500'

  return getAllergySeverityBadgeClasses(formData.value.allergySeverity)
})

const arrivalDateError = computed(() => {
  if (!showAllErrors.value && !touchedFields.value.has('arrivalDateTime')) return undefined
  if (
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
  if (!showAllErrors.value && !touchedFields.value.has('departureDateTime')) return undefined
  if (
    (formData.value.eventAvailability || formData.value.teardownAvailability) &&
    !formData.value.departureDateTime
  ) {
    return t('validation.departure_date_required')
  }
  return undefined
})

const emergencyContactNameError = computed(() => {
  if (!shouldAskEmergencyContact.value) return undefined
  if (!showAllErrors.value && !touchedFields.value.has('emergencyContactName')) return undefined
  if (!formData.value.emergencyContactName?.trim()) {
    return t('validation.emergency_contact_name_required')
  }
  return undefined
})

const emergencyContactPhoneError = computed(() => {
  if (!shouldAskEmergencyContact.value) return undefined
  if (!showAllErrors.value && !touchedFields.value.has('emergencyContactPhone')) return undefined
  if (!formData.value.emergencyContactPhone?.trim()) {
    return t('validation.emergency_contact_phone_required')
  }
  return undefined
})

// Global validation computed properties
const validationErrors = computed(() => {
  const errors: (string | undefined)[] = [
    phoneError.value,
    firstNameError.value,
    lastNameError.value,
    allergySeverityError.value,
    emergencyContactNameError.value,
    emergencyContactPhoneError.value,
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
    props.volunteersInfo?.askTimePreferences ||
    (props.volunteersInfo?.askTeamPreferences && volunteerTeams.value.length > 0) ||
    props.volunteersInfo?.askCompanion ||
    props.volunteersInfo?.askAvoidList
  )
})

// Computed pour savoir si on doit demander le contact d'urgence
const shouldAskEmergencyContact = computed(() => {
  // Demandé explicitement par l'organisateur
  if (props.volunteersInfo?.askEmergencyContact) return true

  // Ou si niveau de sévérité nécessite un contact d'urgence
  if (formData.value.allergySeverity && requiresEmergencyContact(formData.value.allergySeverity))
    return true

  return false
})

const showAboutYouSection = computed(() => {
  return (
    props.volunteersInfo?.askDiet ||
    props.volunteersInfo?.askAllergies ||
    props.volunteersInfo?.askPets ||
    props.volunteersInfo?.askMinors ||
    shouldAskEmergencyContact.value
  )
})

const showWhatYouCanBringSection = computed(() => {
  return (
    props.volunteersInfo?.askVehicle ||
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
    { key: 'morning', label: t('editions.volunteers.time_granularity.morning') },
    { key: 'noon', label: t('editions.volunteers.time_granularity.noon') },
    { key: 'afternoon', label: t('editions.volunteers.time_granularity.afternoon') },
    { key: 'evening', label: t('editions.volunteers.time_granularity.evening') },
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

  const endSetupDate = new Date(props.edition.startDate)
  endSetupDate.setDate(endSetupDate.getDate() - 1)

  const endDate =
    formData.value.setupAvailability && props.volunteersInfo?.setupStartDate
      ? endSetupDate
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

  const startTeardownDate = new Date(props.edition.endDate)
  startTeardownDate.setDate(startTeardownDate.getDate() + 1)

  const startDate =
    formData.value.teardownAvailability && props.volunteersInfo?.teardownEndDate
      ? startTeardownDate
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
  if (!props.volunteersInfo?.askTeamPreferences || !volunteerTeams.value.length) {
    return []
  }
  return volunteerTeams.value.map((team) => ({
    label: team.name,
    value: team.id, // Utiliser l'ID au lieu du nom pour le nouveau système
  }))
})

// Items de créneaux horaires pour UCheckboxGroup
const timeSlotItems = computed(() => [
  { label: t('editions.volunteers.time_slots_options.early_morning'), value: 'early_morning' },
  { label: t('editions.volunteers.time_slots_options.morning'), value: 'morning' },
  { label: t('editions.volunteers.time_slots_options.lunch'), value: 'lunch' },
  { label: t('editions.volunteers.time_slots_options.early_afternoon'), value: 'early_afternoon' },
  { label: t('editions.volunteers.time_slots_options.late_afternoon'), value: 'late_afternoon' },
  { label: t('editions.volunteers.time_slots_options.evening'), value: 'evening' },
  { label: t('editions.volunteers.time_slots_options.late_evening'), value: 'late_evening' },
  { label: t('editions.volunteers.time_slots_options.night'), value: 'night' },
])

const dietPreferenceItems = computed<{ value: 'NONE' | 'VEGETARIAN' | 'VEGAN'; label: string }[]>(
  () => [
    { label: t('diet.none'), value: 'NONE' },
    { label: t('diet.vegetarian'), value: 'VEGETARIAN' },
    { label: t('diet.vegan'), value: 'VEGAN' },
  ]
)

// Methods
const handleAllergiesChange = () => {
  // Si on efface les allergies, on réinitialise le niveau de sévérité
  if (!formData.value.allergies?.trim()) {
    formData.value.allergySeverity = undefined
  }
  // Marquer le champ allergySeverity comme touché si on ajoute des allergies
  if (formData.value.allergies?.trim()) {
    markFieldTouched('allergySeverity')
  }
}

const handleSubmit = () => {
  // Activer l'affichage de toutes les erreurs lors de la soumission
  showAllErrors.value = true

  // Ne soumettre que si le formulaire est valide
  if (isFormValid.value) {
    if (props.isEditing) {
      emit('update', {
        applicationId: props.existingApplication?.id,
        ...formData.value,
      })
    } else {
      emit('submit', formData.value)
    }
  }
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

// Réinitialiser les erreurs à l'ouverture du modal
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      // Réinitialiser le suivi des erreurs
      touchedFields.value.clear()
      showAllErrors.value = false
    }
  }
)

// Function to populate form with existing application data
const populateForm = () => {
  if (props.isEditing && props.existingApplication) {
    // Mode édition : pré-remplir avec les données existantes
    const app = props.existingApplication
    Object.assign(formData.value, {
      phone: app.userSnapshotPhone || props.user?.phone || '',
      firstName: props.user?.prenom || '',
      lastName: props.user?.nom || '',
      setupAvailability: app.setupAvailability ?? false,
      teardownAvailability: app.teardownAvailability ?? false,
      eventAvailability: app.eventAvailability ?? true,
      arrivalDateTime: app.arrivalDateTime || undefined,
      departureDateTime: app.departureDateTime || undefined,
      teamPreferences: (app.teamPreferences as string[]) || [],
      timePreferences: (app.timePreferences as string[]) || [],
      companionName: app.companionName || '',
      avoidList: app.avoidList || '',
      dietPreference: app.dietaryPreference || 'NONE',
      allergies: app.allergies || '',
      allergySeverity: app.allergySeverity || undefined,
      emergencyContactName: app.emergencyContactName || '',
      emergencyContactPhone: app.emergencyContactPhone || '',
      hasPets: app.hasPets ?? false,
      petsDetails: app.petsDetails || '',
      hasMinors: app.hasMinors ?? false,
      minorsDetails: app.minorsDetails || '',
      hasVehicle: app.hasVehicle ?? false,
      vehicleDetails: app.vehicleDetails || '',
      skills: app.skills || '',
      hasExperience: app.hasExperience ?? false,
      experienceDetails: app.experienceDetails || '',
      motivation: app.motivation || '',
      modificationNote: '', // Toujours réinitialiser la note de modification en mode édition
    })
  } else {
    // Mode création : réinitialiser avec les infos utilisateur
    Object.assign(formData.value, {
      phone: props.user?.phone || '',
      firstName: props.user?.prenom || '',
      lastName: props.user?.nom || '',
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
      allergySeverity: undefined,
      emergencyContactName: '',
      emergencyContactPhone: '',
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
      modificationNote: '',
    })
  }
}

// Reset or populate form when modal opens
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      populateForm()
    }
  }
)

// Watch for changes in existingApplication to repopulate form
watch(
  () => props.existingApplication,
  () => {
    if (props.modelValue && props.isEditing) {
      populateForm()
    }
  },
  { deep: true }
)
</script>
