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
          <UButtonGroup>
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
          </UButtonGroup>
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
          <UButtonGroup>
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
          </UButtonGroup>
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
      :disabled="saving || teams.length === 0"
      color="primary"
      class="mb-2"
      :label="
        teams.length === 0
          ? t('editions.volunteers.ask_team_preferences_label') +
            ' (définissez d\'abord des équipes)'
          : t('editions.volunteers.ask_team_preferences_label')
      "
      size="lg"
      @update:model-value="handleChange('askTeamPreferences', $event)"
    />

    <!-- Gestion des équipes (mode interne uniquement) -->
    <div class="mt-6 space-y-4">
      <div class="space-y-2">
        <h4 class="font-medium text-gray-700 dark:text-gray-300">
          {{ t('editions.volunteers.teams_label') }}
        </h4>
        <p class="text-xs text-gray-500">
          {{ t('editions.volunteers.teams_hint') }}
        </p>
      </div>

      <div class="space-y-3">
        <div v-if="teams.length === 0" class="text-sm text-gray-500 italic">
          {{ t('editions.volunteers.teams_empty') }}
        </div>

        <div v-for="(team, index) in teams" :key="index" class="flex gap-2 items-start">
          <UInput
            v-model="team.name"
            :placeholder="t('editions.volunteers.team_name_placeholder')"
            class="flex-1"
            :disabled="saving"
            @blur="handleTeamChange"
          />
          <UInput
            v-model.number="team.slots"
            type="number"
            min="1"
            max="99"
            :placeholder="t('editions.volunteers.team_slots_placeholder')"
            class="w-20"
            :disabled="saving"
            @blur="handleTeamChange"
          />
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            :disabled="saving"
            @click="removeTeam(index)"
          >
            {{ t('editions.volunteers.team_remove') }}
          </UButton>
        </div>

        <UButton
          icon="i-heroicons-plus"
          variant="outline"
          size="sm"
          :disabled="saving"
          @click="addTeam"
        >
          {{ t('editions.volunteers.team_add') }}
        </UButton>
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
const teams = ref<{ name: string; slots?: number }[]>(
  props.initialData?.teams ? JSON.parse(JSON.stringify(props.initialData.teams)) : []
)

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

const handleTeamChange = async () => {
  const filteredTeams = teams.value.filter((team) => team.name.trim())
  await persistSettings({ teams: filteredTeams })
}

const addTeam = () => {
  teams.value.push({ name: '', slots: undefined })
}

const removeTeam = async (index: number) => {
  teams.value.splice(index, 1)
  if (teams.value.length === 0) {
    askTeamPreferences.value = false
  }
  const filteredTeams = teams.value.filter((team) => team.name.trim())
  await persistSettings({ teams: filteredTeams })
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
        title: error?.data?.statusMessage || error?.statusMessage || t('common.error'),
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
      teams.value = newData.teams ? JSON.parse(JSON.stringify(newData.teams)) : []
    }
  },
  { deep: true }
)
</script>
