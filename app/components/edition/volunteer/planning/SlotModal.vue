<template>
  <UModal v-model:open="isOpen" size="lg" prevent-close>
    <template #header>
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-full bg-primary-100 dark:bg-primary-900">
          <UIcon
            :name="formState.id ? 'i-heroicons-pencil-square' : 'i-heroicons-plus'"
            class="w-5 h-5 text-primary-600 dark:text-primary-400"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ modalTitle }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{
              formState.id
                ? t('edition.volunteers.edit_slot_subtitle')
                : t('edition.volunteers.create_slot_subtitle')
            }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <UForm :schema="slotSchema" :state="formState" class="space-y-6" @submit="onSubmit">
        <!-- Titre du créneau -->
        <UFormField name="title" :label="t('edition.volunteers.slot_title')" class="w-full">
          <UInput
            ref="titleInput"
            v-model="formState.title"
            :placeholder="$t('edition.volunteers.slot_title_placeholder')"
            icon="i-heroicons-tag"
            :autofocus="!readOnly"
            :disabled="readOnly"
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField name="description" :label="t('common.description')" class="w-full">
          <UTextarea
            v-model="formState.description"
            :placeholder="t('edition.volunteers.slot_description_placeholder')"
            :rows="3"
            :disabled="readOnly"
            resize
            class="w-full"
          />
        </UFormField>

        <!-- Section équipe -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-user-group" class="w-4 h-4 text-blue-600" />
            <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ t('edition.volunteers.team_assignment') }}
            </h4>
          </div>

          <!-- Équipe assignée -->
          <UFormField name="teamId" :label="t('edition.volunteers.assigned_team')">
            <USelect
              v-if="teamOptions.length > 2"
              v-model="formState.teamId"
              :items="enhancedTeamOptions"
              :placeholder="t('edition.volunteers.select_team')"
              :disabled="readOnly"
              icon="i-heroicons-user-group"
            >
              <template #item-label="{ item }">
                <div class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: item.color || '#6b7280' }"
                  ></div>
                  <span>{{ item.label }}</span>
                </div>
              </template>
            </USelect>
            <div
              v-else-if="teamOptions.length === 2"
              class="flex items-center gap-2 p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
            >
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-blue-500" />
              <span class="text-sm text-gray-600 dark:text-gray-300">
                {{
                  teamOptions.find((option) => option.value !== 'unassigned')?.label ||
                  t('edition.volunteers.no_team')
                }}
              </span>
            </div>
            <div
              v-else
              class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-yellow-600" />
              <span class="text-sm text-yellow-700 dark:text-yellow-300">
                {{ t('edition.volunteers.no_teams_available') }}
              </span>
            </div>
          </UFormField>
        </div>

        <!-- Section horaires -->
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-4 h-4 text-green-600" />
              <h4 class="text-sm font-medium text-green-800 dark:text-green-200">
                {{ t('edition.volunteers.schedule_info') }}
              </h4>
            </div>
            <div
              v-if="calculatedDuration"
              class="text-xs text-green-600 dark:text-green-400 font-medium"
            >
              {{ calculatedDuration }}
            </div>
          </div>

          <!-- Dates et heures -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField name="startDateTime" :label="t('common.start_date')" required>
              <UInput
                v-model="formState.startDateTime"
                type="datetime-local"
                icon="i-heroicons-play"
                :disabled="readOnly"
                @change="onStartDateChange"
              />
            </UFormField>
            <UFormField name="endDateTime" :label="t('common.end_date')" required>
              <UInput
                v-model="formState.endDateTime"
                type="datetime-local"
                icon="i-heroicons-stop"
                :disabled="readOnly"
                :class="dateValidationClass"
              />
            </UFormField>
          </div>

          <!-- Raccourcis durée -->
          <div v-if="!readOnly" class="flex flex-wrap gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400 mr-2"
              >{{ t('edition.volunteers.quick_duration') }}:</span
            >
            <UButton
              v-for="duration in quickDurations"
              :key="duration.label"
              size="xs"
              variant="soft"
              color="primary"
              @click="setDuration(duration.hours)"
            >
              {{ duration.label }}
            </UButton>
          </div>
        </div>

        <!-- Section bénévoles -->
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-users" class="w-4 h-4 text-purple-600" />
            <h4 class="text-sm font-medium text-purple-800 dark:text-purple-200">
              {{ t('edition.volunteers.volunteers_needed') }}
            </h4>
          </div>

          <!-- Nombre de bénévoles -->
          <UFormField name="maxVolunteers" :label="t('edition.volunteers.max_volunteers')" required>
            <div class="flex items-center gap-3">
              <UInput
                v-model.number="formState.maxVolunteers"
                type="number"
                min="1"
                max="50"
                :placeholder="$t('edition.volunteers.max_volunteers_placeholder')"
                :disabled="readOnly"
                icon="i-heroicons-users"
                class="flex-1"
              />
              <!-- Boutons rapides -->
              <div v-if="!readOnly" class="flex gap-1">
                <UButton
                  v-for="num in [1, 2, 3, 5, 10]"
                  :key="num"
                  size="xs"
                  variant="soft"
                  color="primary"
                  :class="{ 'ring-2 ring-purple-400': formState.maxVolunteers === num }"
                  @click="formState.maxVolunteers = num"
                >
                  {{ num }}
                </UButton>
              </div>
            </div>
            <template #hint>
              <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                {{ t('edition.volunteers.max_volunteers_hint') }}
              </div>
            </template>
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div
        v-if="readOnly"
        class="flex justify-end items-center pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <UButton color="primary" @click="close">{{ t('common.close') }}</UButton>
      </div>
      <div
        v-else
        class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div>
          <UButton
            v-if="formState.id"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            :loading="loading"
            @click="onDelete"
          >
            {{ t('common.delete') }}
          </UButton>
        </div>
        <div class="flex gap-3">
          <UButton variant="ghost" :disabled="loading" @click="close">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="loading" :disabled="!isFormValid" @click="onSubmit">
            <template #leading>
              <UIcon :name="formState.id ? 'i-heroicons-check' : 'i-heroicons-plus'" />
            </template>
            {{ formState.id ? t('common.save') : t('common.create') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'

import { useDatetime } from '~/composables/useDatetime'
import type { VolunteerTimeSlot } from '~/composables/useVolunteerSchedule'
import type { VolunteerTeam } from '~/composables/useVolunteerTeams'

// Props
interface Props {
  modelValue: boolean
  teams: VolunteerTeam[]
  editionId: number
  initialSlot?: Partial<VolunteerTimeSlot> & {
    startDateTime?: string
    endDateTime?: string
  }
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [slot: Omit<VolunteerTimeSlot, 'id'> & { id?: string }]
  delete: [slotId: string]
}>()

// i18n
const { t } = useI18n()

// Composable dates
const { toDatetimeLocal, fromDatetimeLocal, toApiFormat } = useDatetime()

// État
const loading = ref(false)
const titleInput = ref()

// Durées rapides prédéfinies
const quickDurations = [
  { label: '30min', hours: 0.5 },
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: '4h', hours: 4 },
]

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const modalTitle = computed(() =>
  formState.value.id ? t('edition.volunteers.edit_slot') : t('edition.volunteers.create_slot')
)

const teamOptions = computed(() => [
  { value: 'unassigned', label: t('edition.volunteers.no_team') },
  ...props.teams.map((team) => ({
    value: team.id,
    label: team.name,
  })),
])

const enhancedTeamOptions = computed(() => [
  { value: 'unassigned', label: t('edition.volunteers.no_team'), color: '#6b7280' },
  ...props.teams.map((team) => ({
    value: team.id,
    label: team.name,
    color: team.color || '#6b7280',
  })),
])

// Validation du formulaire
const isFormValid = computed(() => {
  return (
    formState.value.startDateTime &&
    formState.value.endDateTime &&
    formState.value.maxVolunteers > 0 &&
    new Date(formState.value.startDateTime) < new Date(formState.value.endDateTime)
  )
})

// Calcul de la durée
const calculatedDuration = computed(() => {
  if (!formState.value.startDateTime || !formState.value.endDateTime) return null

  const start = new Date(formState.value.startDateTime)
  const end = new Date(formState.value.endDateTime)
  const diffMs = end.getTime() - start.getTime()

  if (diffMs <= 0) return t('edition.volunteers.invalid_duration')

  const diffHours = diffMs / (1000 * 60 * 60)
  const hours = Math.floor(diffHours)
  const minutes = Math.round((diffHours - hours) * 60)

  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${minutes.toString().padStart(2, '0')}min`
})

// Classe de validation des dates
const dateValidationClass = computed(() => {
  if (!formState.value.startDateTime || !formState.value.endDateTime) return ''

  const start = new Date(formState.value.startDateTime)
  const end = new Date(formState.value.endDateTime)

  return start >= end
    ? 'border-red-300 dark:border-red-600'
    : 'border-green-300 dark:border-green-600'
})

// Schéma de validation
const slotSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  teamId: z.string().optional(),
  startDateTime: z.string().min(1, t('errors.required_field')),
  endDateTime: z.string().min(1, t('errors.required_field')),
  maxVolunteers: z.number().min(1).max(50),
})

// État du formulaire
const formState = ref({
  id: '',
  title: '',
  description: '',
  teamId: 'unassigned',
  startDateTime: '',
  endDateTime: '',
  maxVolunteers: 3,
})

// Watchers
watch(
  () => props.initialSlot,
  (newSlot) => {
    if (newSlot) {
      formState.value = {
        id: newSlot.id || '',
        title: newSlot.title || '',
        description: newSlot.description || '',
        teamId: newSlot.teamId || 'unassigned',
        startDateTime: newSlot.startDateTime || '',
        endDateTime: newSlot.endDateTime || '',
        maxVolunteers: newSlot.maxVolunteers || 3,
      }
    } else {
      // Réinitialiser le formulaire
      formState.value = {
        id: '',
        title: '',
        description: '',
        teamId: 'unassigned',
        startDateTime: '',
        endDateTime: '',
        maxVolunteers: 3,
      }
    }

    // Si une seule équipe disponible, la sélectionner automatiquement
    if (teamOptions.value.length === 2 && formState.value.teamId === 'unassigned') {
      const uniqueTeam = teamOptions.value.find((option) => option.value !== 'unassigned')
      if (uniqueTeam) {
        formState.value.teamId = uniqueTeam.value
      }
    }
  },
  { immediate: true, deep: true }
)

// Watcher pour auto-sélectionner l'équipe unique
watch(
  teamOptions,
  (newOptions) => {
    // Si une seule équipe et pas déjà sélectionnée, l'auto-sélectionner
    if (newOptions.length === 2 && formState.value.teamId === 'unassigned') {
      const uniqueTeam = newOptions.find((option) => option.value !== 'unassigned')
      if (uniqueTeam) {
        formState.value.teamId = uniqueTeam.value
      }
    }
  },
  { immediate: true }
)

// Actions
const close = () => {
  isOpen.value = false
}

// Définir la durée automatiquement
const setDuration = (hours: number) => {
  if (!formState.value.startDateTime) return

  // Convertir datetime-local en Date
  const startDate = fromDatetimeLocal(formState.value.startDateTime)
  if (!startDate) return

  // Ajouter la durée
  const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000)

  // Reconvertir en datetime-local pour l'input
  formState.value.endDateTime = toDatetimeLocal(endDate)
}

// Gestion du changement de date de début
const onStartDateChange = () => {
  // Si pas de date de fin ou date de fin antérieure au début, ajuster automatiquement
  if (
    !formState.value.endDateTime ||
    new Date(formState.value.endDateTime) <= new Date(formState.value.startDateTime)
  ) {
    setDuration(2) // 2h par défaut
  }
}

const onSubmit = async () => {
  try {
    loading.value = true

    // Trouver la couleur de l'équipe sélectionnée
    const selectedTeam = props.teams.find((t) => t.id === formState.value.teamId)
    const color = selectedTeam?.color || '#6b7280'

    // Convertir les dates en format ISO pour l'API
    const startDate = fromDatetimeLocal(formState.value.startDateTime)
    const endDate = fromDatetimeLocal(formState.value.endDateTime)

    const slotData = {
      id: formState.value.id || undefined,
      title: formState.value.title?.trim() || null,
      description: formState.value.description || '',
      teamId: formState.value.teamId === 'unassigned' ? undefined : formState.value.teamId,
      start: toApiFormat(startDate),
      end: toApiFormat(endDate),
      maxVolunteers: formState.value.maxVolunteers,
      assignedVolunteers: 0,
      color,
    }

    emit('save', slotData)
    close()
  } finally {
    loading.value = false
  }
}

const onDelete = async () => {
  if (!formState.value.id) return

  if (confirm(t('edition.volunteers.confirm_delete_slot'))) {
    try {
      loading.value = true
      emit('delete', formState.value.id)
      close()
    } finally {
      loading.value = false
    }
  }
}

// Focus sur le titre à l'ouverture pour un nouveau créneau
watch([isOpen, () => formState.value.id], ([isOpenValue, slotId]) => {
  if (isOpenValue && !slotId && !props.readOnly) {
    nextTick(() => {
      titleInput.value?.focus()
    })
  }
})
</script>
