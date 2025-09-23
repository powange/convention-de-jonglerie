<template>
  <div class="space-y-4">
    <div v-if="showTitle" class="mt-4 mb-2">
      <h3 class="font-semibold text-gray-700 dark:text-gray-300">
        {{ t('editions.internal_mode_options') }}
      </h3>
    </div>

    <!-- Dates de montage -->
    <div class="space-y-4 mb-4">
      <UFormField
        :label="t('editions.volunteers.setup_start_date_label')"
        :error="fieldErrors.setupStartDate"
      >
        <UPopover>
          <UFieldGroup>
            <UButton
              :disabled="saving"
              variant="outline"
              color="neutral"
              icon="i-heroicons-calendar-days"
            >
              {{
                setupStartDate
                  ? toCalendarDate(setupStartDate).toString()
                  : t('forms.labels.select_date')
              }}
            </UButton>
            <UButton
              v-if="setupStartDate"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="handleSetupStartDateClear"
            />
          </UFieldGroup>
          <template #content>
            <UCalendar
              v-model="setupStartDate"
              :max-value="setupStartDateMaxValue"
              @update:model-value="handleSetupStartDateChange"
            />
          </template>
        </UPopover>
      </UFormField>

      <UFormField :label="t('editions.volunteers.setup_end_date_label')">
        <UPopover>
          <UFieldGroup>
            <UButton
              :disabled="saving"
              variant="outline"
              color="neutral"
              icon="i-heroicons-calendar-days"
            >
              {{
                teardownEndDate
                  ? toCalendarDate(teardownEndDate).toString()
                  : t('forms.labels.select_date')
              }}
            </UButton>
            <UButton
              v-if="teardownEndDate"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="handleTeardownEndDateClear"
            />
          </UFieldGroup>
          <template #content>
            <UCalendar
              v-model="teardownEndDate"
              :min-value="setupEndDateMinValue"
              @update:model-value="handleTeardownEndDateChange"
            />
          </template>
        </UPopover>
      </UFormField>
    </div>

    <!-- Switch demander participation au montage -->
    <USwitch
      v-model="askSetup"
      :disabled="saving || !setupStartDate"
      color="primary"
      class="mb-2"
      :label="
        !setupStartDate
          ? t('editions.volunteers.ask_setup_label') +
            ' (définissez d\'abord la date de début du montage)'
          : t('editions.volunteers.ask_setup_label')
      "
      size="lg"
      @update:model-value="handleChange('askSetup', $event)"
    />

    <!-- Switch demander participation au démontage -->
    <USwitch
      v-model="askTeardown"
      :disabled="saving || !teardownEndDate"
      color="primary"
      class="mb-2"
      :label="
        !teardownEndDate
          ? t('editions.volunteers.ask_teardown_label') +
            ' (définissez d\'abord la date de fin du démontage)'
          : t('editions.volunteers.ask_teardown_label')
      "
      size="lg"
      @update:model-value="handleChange('askTeardown', $event)"
    />

    <!-- Switch demander régime alimentaire (mode interne uniquement) -->
    <USwitch
      v-model="askDiet"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_diet_label')"
      size="lg"
      @update:model-value="handleChange('askDiet', $event)"
    />

    <!-- Switch demander allergies (mode interne uniquement) -->
    <USwitch
      v-model="askAllergies"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_allergies_label')"
      size="lg"
      @update:model-value="handleChange('askAllergies', $event)"
    />

    <!-- Switch demander animaux de compagnie (mode interne uniquement) -->
    <USwitch
      v-model="askPets"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_pets_label')"
      size="lg"
      @update:model-value="handleChange('askPets', $event)"
    />

    <!-- Switch demander personnes mineures (mode interne uniquement) -->
    <USwitch
      v-model="askMinors"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_minors_label')"
      size="lg"
      @update:model-value="handleChange('askMinors', $event)"
    />

    <!-- Switch demander véhicule (mode interne uniquement) -->
    <USwitch
      v-model="askVehicle"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_vehicle_label')"
      size="lg"
      @update:model-value="handleChange('askVehicle', $event)"
    />

    <!-- Switch demander compagnon (mode interne uniquement) -->
    <USwitch
      v-model="askCompanion"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_companion_label')"
      size="lg"
      @update:model-value="handleChange('askCompanion', $event)"
    />

    <!-- Switch demander liste à éviter (mode interne uniquement) -->
    <USwitch
      v-model="askAvoidList"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_avoid_list_label')"
      size="lg"
      @update:model-value="handleChange('askAvoidList', $event)"
    />

    <!-- Switch demander compétences/certifications -->
    <USwitch
      v-model="askSkills"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_skills_label')"
      size="lg"
      @update:model-value="handleChange('askSkills', $event)"
    />

    <!-- Switch demander expérience bénévolat -->
    <USwitch
      v-model="askExperience"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_experience_label')"
      size="lg"
      @update:model-value="handleChange('askExperience', $event)"
    />

    <!-- Switch demander préférences horaires (mode interne uniquement) -->
    <USwitch
      v-model="askTimePreferences"
      :disabled="saving"
      color="primary"
      class="mb-2"
      :label="t('editions.volunteers.ask_time_preferences_label')"
      size="lg"
      @update:model-value="handleChange('askTimePreferences', $event)"
    />

    <!-- Switch demander préférences d'équipes (mode interne uniquement) -->
    <USwitch
      v-model="askTeamPreferences"
      :disabled="saving || volunteerTeams.length === 0"
      color="primary"
      class="mb-2"
      :label="
        volunteerTeams.length === 0
          ? t('editions.volunteers.ask_team_preferences_label') +
            ' (définissez d\'abord des équipes)'
          : t('editions.volunteers.ask_team_preferences_label')
      "
      size="lg"
      @update:model-value="handleChange('askTeamPreferences', $event)"
    />

    <!-- Équipes de bénévoles (affichage lecture seule) -->
    <div class="mt-6 space-y-4">
      <div class="flex items-center justify-between">
        <div class="space-y-2">
          <h4 class="font-medium text-gray-700 dark:text-gray-300">
            {{ t('editions.volunteers.teams_label') }}
          </h4>
          <p class="text-xs text-gray-500">Liste des équipes de bénévoles configurées</p>
        </div>
        <UButton
          :to="`/editions/${editionId}/gestion/volunteers/teams`"
          color="primary"
          variant="soft"
          size="sm"
          icon="i-heroicons-pencil"
        >
          Gérer les équipes
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-if="volunteerTeams.length === 0"
          class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
        >
          Aucune équipe configurée.
          <UButton
            :to="`/editions/${editionId}/gestion/volunteers/teams`"
            variant="ghost"
            size="xs"
            class="ml-1"
          >
            Créer une équipe
          </UButton>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="team in volunteerTeams"
            :key="team.id"
            class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: team.color }" />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-gray-900 dark:text-white truncate">
                {{ team.name }}
              </p>
              <p v-if="team.maxVolunteers" class="text-xs text-gray-500">
                Max: {{ team.maxVolunteers }} bénévoles
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Indicateur de sauvegarde -->
    <div v-if="saving" class="flex gap-2 text-xs text-gray-500 items-center">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
      {{ $t('common.saving') || 'Enregistrement...' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { type DateValue, fromDate, toCalendarDate } from '@internationalized/date'
import { computed, ref, watch } from 'vue'

import { useVolunteerTeams } from '~/composables/useVolunteerTeams'

interface Props {
  editionId: number
  showTitle?: boolean
  initialData?: {
    setupStartDate?: DateValue | null
    teardownEndDate?: DateValue | null
    askSetup?: boolean
    askTeardown?: boolean
    askDiet?: boolean
    askAllergies?: boolean
    askPets?: boolean
    askMinors?: boolean
    askVehicle?: boolean
    askCompanion?: boolean
    askAvoidList?: boolean
    askSkills?: boolean
    askExperience?: boolean
    askTimePreferences?: boolean
    askTeamPreferences?: boolean
    teams?: { name: string; slots?: number }[]
  }
  editionStartDate?: Date
  editionEndDate?: Date
}

interface Emits {
  (e: 'updated', data: any): void
}

const props = withDefaults(defineProps<Props>(), {
  showTitle: true,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

// Récupération des équipes depuis la nouvelle table
const { teams: volunteerTeams } = useVolunteerTeams(props.editionId)

// État local
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

// Données du composant
const setupStartDate = ref<DateValue | null>(props.initialData?.setupStartDate || null)
const teardownEndDate = ref<DateValue | null>(props.initialData?.teardownEndDate || null)
const askSetup = ref(props.initialData?.askSetup || false)
const askTeardown = ref(props.initialData?.askTeardown || false)
const askDiet = ref(props.initialData?.askDiet || false)
const askAllergies = ref(props.initialData?.askAllergies || false)
const askPets = ref(props.initialData?.askPets || false)
const askMinors = ref(props.initialData?.askMinors || false)
const askVehicle = ref(props.initialData?.askVehicle || false)
const askCompanion = ref(props.initialData?.askCompanion || false)
const askAvoidList = ref(props.initialData?.askAvoidList || false)
const askSkills = ref(props.initialData?.askSkills || false)
const askExperience = ref(props.initialData?.askExperience || false)
const askTimePreferences = ref(props.initialData?.askTimePreferences || false)
const askTeamPreferences = ref(props.initialData?.askTeamPreferences || false)

// Contraintes de dates
const setupStartDateMaxValue = computed(() => {
  if (!props.editionStartDate) return null
  return fromDate(new Date(props.editionStartDate), 'UTC')
})

const setupEndDateMinValue = computed(() => {
  if (!props.editionEndDate) return null
  return fromDate(new Date(props.editionEndDate), 'UTC')
})

// Fonctions de gestion des changements
const handleChange = async (field: string, value: any) => {
  const data: any = {}
  data[field] = value
  await persistSettings(data)
}

const handleSetupStartDateChange = async () => {
  const data: any = {
    setupStartDate: setupStartDate.value
      ? new Date(toCalendarDate(setupStartDate.value).toString()).toISOString()
      : null,
  }
  fieldErrors.value = { ...fieldErrors.value }
  delete fieldErrors.value.setupStartDate
  await persistSettings(data)
}

const handleSetupStartDateClear = async () => {
  setupStartDate.value = null
  askSetup.value = false
  const data: any = {
    setupStartDate: null,
    askSetup: false,
  }
  await persistSettings(data)
}

const handleTeardownEndDateChange = async () => {
  const data: any = {
    setupEndDate: teardownEndDate.value
      ? new Date(toCalendarDate(teardownEndDate.value).toString()).toISOString()
      : null,
  }
  await persistSettings(data)
}

const handleTeardownEndDateClear = async () => {
  teardownEndDate.value = null
  askTeardown.value = false
  const data: any = {
    setupEndDate: null,
    askTeardown: false,
  }
  await persistSettings(data)
}

// Fonction principale de sauvegarde
const persistSettings = async (data: any) => {
  if (!props.editionId) return

  saving.value = true

  try {
    const response: any = await $fetch(`/api/editions/${props.editionId}/volunteers/settings`, {
      method: 'PATCH',
      body: data,
    })

    if (response?.settings) {
      // Émettre l'événement avec les nouvelles données
      emit('updated', response.settings)

      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    // Gérer les erreurs de validation par champ
    if (error?.data?.data?.errors) {
      fieldErrors.value = error.data.data.errors
      toast.add({
        title: error.data.data.message || 'Erreurs de validation',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    } else {
      // Erreur générale
      fieldErrors.value = {}
      toast.add({
        title: error?.data?.message || error?.message || t('common.error'),
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    }
  } finally {
    saving.value = false
  }
}

// Watcher pour mettre à jour les données depuis l'extérieur
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      setupStartDate.value = newData.setupStartDate || null
      teardownEndDate.value = newData.teardownEndDate || null
      askSetup.value = newData.askSetup || false
      askTeardown.value = newData.askTeardown || false
      askDiet.value = newData.askDiet || false
      askAllergies.value = newData.askAllergies || false
      askPets.value = newData.askPets || false
      askMinors.value = newData.askMinors || false
      askVehicle.value = newData.askVehicle || false
      askCompanion.value = newData.askCompanion || false
      askAvoidList.value = newData.askAvoidList || false
      askSkills.value = newData.askSkills || false
      askExperience.value = newData.askExperience || false
      askTimePreferences.value = newData.askTimePreferences || false
      askTeamPreferences.value = newData.askTeamPreferences || false
    }
  },
  { deep: true }
)
</script>
