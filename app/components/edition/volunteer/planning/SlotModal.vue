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
                ? t('editions.volunteers.edit_slot_subtitle')
                : t('editions.volunteers.create_slot_subtitle')
            }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <UForm :schema="slotSchema" :state="formState" class="space-y-6" @submit="onSubmit">
        <!-- Titre du créneau -->
        <UFormField name="title" :label="t('editions.volunteers.slot_title')" class="w-full">
          <UInput
            ref="titleInput"
            v-model="formState.title"
            :placeholder="$t('editions.volunteers.slot_title_placeholder')"
            icon="i-heroicons-tag"
            autofocus
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField name="description" :label="t('common.description')" class="w-full">
          <UTextarea
            v-model="formState.description"
            :placeholder="t('editions.volunteers.slot_description_placeholder')"
            :rows="3"
            resize
            class="w-full"
          />
        </UFormField>

        <!-- Section équipe -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-user-group" class="w-4 h-4 text-blue-600" />
            <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ t('editions.volunteers.team_assignment') }}
            </h4>
          </div>

          <!-- Équipe assignée -->
          <UFormField name="teamId" :label="t('editions.volunteers.assigned_team')">
            <USelect
              v-if="teamOptions.length > 2"
              v-model="formState.teamId"
              :items="enhancedTeamOptions"
              :placeholder="t('editions.volunteers.select_team')"
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
                  t('editions.volunteers.no_team')
                }}
              </span>
            </div>
            <div
              v-else
              class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-yellow-600" />
              <span class="text-sm text-yellow-700 dark:text-yellow-300">
                {{ t('editions.volunteers.no_teams_available') }}
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
                {{ t('editions.volunteers.schedule_info') }}
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
                @change="onStartDateChange"
              />
            </UFormField>
            <UFormField name="endDateTime" :label="t('common.end_date')" required>
              <UInput
                v-model="formState.endDateTime"
                type="datetime-local"
                icon="i-heroicons-stop"
                :class="dateValidationClass"
              />
            </UFormField>
          </div>

          <!-- Raccourcis durée -->
          <div class="flex flex-wrap gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400 mr-2"
              >{{ t('editions.volunteers.quick_duration') }}:</span
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
              {{ t('editions.volunteers.volunteers_needed') }}
            </h4>
          </div>

          <!-- Nombre de bénévoles -->
          <UFormField
            name="maxVolunteers"
            :label="t('editions.volunteers.max_volunteers')"
            required
          >
            <div class="flex items-center gap-3">
              <UInput
                v-model.number="formState.maxVolunteers"
                type="number"
                min="1"
                max="50"
                :placeholder="$t('editions.volunteers.max_volunteers_placeholder')"
                icon="i-heroicons-users"
                class="flex-1"
              />
              <!-- Boutons rapides -->
              <div class="flex gap-1">
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
                {{ t('editions.volunteers.max_volunteers_hint') }}
              </div>
            </template>
          </UFormField>
        </div>

        <!-- Section assignations -->
        <div
          v-if="formState.id"
          class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 space-y-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-plus" class="w-4 h-4 text-orange-600" />
              <h4 class="text-sm font-medium text-orange-800 dark:text-orange-200">
                {{ t('editions.volunteers.assigned_volunteers') }}
              </h4>
            </div>
            <UBadge color="warning" variant="soft" size="sm">
              {{ assignments.length }}/{{ formState.maxVolunteers }}
            </UBadge>
          </div>

          <!-- Bénévoles assignés -->
          <div v-if="assignments.length > 0" class="space-y-2">
            <div
              v-for="assignment in assignments"
              :key="assignment.id"
              class="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md border"
            >
              <div class="flex items-center gap-2">
                <UiUserAvatar :user="assignment.user" size="sm" />
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ assignment.user.pseudo }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ assignment.user.prenom }} {{ assignment.user.nom }}
                  </p>
                </div>
              </div>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-heroicons-x-mark"
                @click="unassignVolunteer(assignment.id)"
              >
                {{ t('common.remove') }}
              </UButton>
            </div>
          </div>

          <div v-else class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            {{ t('editions.volunteers.no_assigned_volunteers') }}
          </div>

          <!-- Ajouter un bénévole -->
          <div v-if="assignments.length < formState.maxVolunteers" class="border-t pt-3">
            <UButton
              color="warning"
              variant="soft"
              size="sm"
              icon="i-heroicons-plus"
              @click="showVolunteerSelector = true"
            >
              {{ t('editions.volunteers.add_volunteer') }}
            </UButton>
          </div>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div
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

  <!-- Modal de sélection des bénévoles -->
  <UModal v-model:open="showVolunteerSelector" size="md">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-primary-600" />
        <h3 class="text-lg font-semibold">{{ t('editions.volunteers.select_volunteer') }}</h3>
      </div>
    </template>

    <template #body>
      <div v-if="assignmentLoading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
      </div>

      <div v-else-if="filteredAvailableVolunteers.length === 0" class="text-center py-8">
        <UIcon name="i-heroicons-user-group" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400">
          {{
            formState.teamId && formState.teamId !== 'unassigned'
              ? t('editions.volunteers.no_volunteers_for_team')
              : t('editions.volunteers.no_available_volunteers')
          }}
        </p>
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="volunteer in filteredAvailableVolunteers"
          :key="volunteer.userId"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center gap-3">
            <UiUserAvatar
              :user="{
                id: volunteer.userId,
                pseudo: volunteer.pseudo,
                nom: volunteer.nom,
                prenom: volunteer.prenom,
                email: volunteer.email,
              }"
              size="sm"
            />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ volunteer.pseudo }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ volunteer.prenom }} {{ volunteer.nom }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500">
                {{ volunteer.assignmentsCount }} {{ t('editions.volunteers.current_assignments') }}
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            variant="soft"
            size="sm"
            @click="assignVolunteer(volunteer.userId)"
          >
            {{ t('editions.volunteers.assign') }}
          </UButton>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton variant="ghost" @click="showVolunteerSelector = false">
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'

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
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [slot: Omit<VolunteerTimeSlot, 'id'> & { id?: string }]
  delete: [slotId: string]
}>()

// i18n
const { t } = useI18n()

// État
const loading = ref(false)
const titleInput = ref()
const showVolunteerSelector = ref(false)
interface Assignment {
  id: string
  user: {
    id: number
    pseudo: string
    nom: string | null
    prenom: string | null
    email: string
  }
  assignedBy: {
    id: number
    pseudo: string
  } | null
  assignedAt: string
}

interface AvailableVolunteer {
  applicationId: number
  userId: number
  pseudo: string
  nom: string | null
  prenom: string | null
  email: string
  teamPreferences: any[]
  assignedTeams: string[] // Array d'IDs des équipes assignées
  timePreferences: any[]
  skills: string[]
  currentAssignments: any[]
  assignmentsCount: number
}

const assignments = ref<Assignment[]>([])
const availableVolunteers = ref<AvailableVolunteer[]>([])
const assignmentLoading = ref(false)

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
  formState.value.id ? t('editions.volunteers.edit_slot') : t('editions.volunteers.create_slot')
)

const teamOptions = computed(() => [
  { value: 'unassigned', label: t('editions.volunteers.no_team') },
  ...props.teams.map((team) => ({
    value: team.id,
    label: team.name,
  })),
])

const enhancedTeamOptions = computed(() => [
  { value: 'unassigned', label: t('editions.volunteers.no_team'), color: '#6b7280' },
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

  if (diffMs <= 0) return t('editions.volunteers.invalid_duration')

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

// Bénévoles filtrés selon l'équipe du créneau et excluant ceux déjà assignés
const filteredAvailableVolunteers = computed(() => {
  const currentTeamId = formState.value.teamId === 'unassigned' ? null : formState.value.teamId
  const currentAssignmentIds = assignments.value.map((a) => a.user.id)

  return availableVolunteers.value.filter((volunteer) => {
    // Exclure les bénévoles déjà assignés à ce créneau
    if (currentAssignmentIds.includes(volunteer.userId)) {
      return false
    }

    // Si le créneau n'a pas d'équipe spécifique, montrer tous les bénévoles disponibles
    if (!currentTeamId) {
      return true
    }

    // Filtrer par équipe assignée
    const assignedTeamIds = volunteer.assignedTeams || []
    return assignedTeamIds.includes(currentTeamId)
  })
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

  const start = new Date(formState.value.startDateTime)
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000)

  // Format pour datetime-local
  formState.value.endDateTime = end.toISOString().slice(0, 16)
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

    const slotData = {
      id: formState.value.id || undefined,
      title: formState.value.title?.trim() || null,
      description: formState.value.description || '',
      teamId: formState.value.teamId === 'unassigned' ? undefined : formState.value.teamId,
      start: formState.value.startDateTime,
      end: formState.value.endDateTime,
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

  if (confirm(t('editions.volunteers.confirm_delete_slot'))) {
    try {
      loading.value = true
      emit('delete', formState.value.id)
      close()
    } finally {
      loading.value = false
    }
  }
}

// Fonctions d'assignation
const fetchAssignments = async () => {
  if (!formState.value.id) return

  try {
    const response = await $fetch(
      `/api/editions/${props.editionId}/volunteer-time-slots/${formState.value.id}/assignments`
    )
    assignments.value = response as Assignment[]
  } catch (error) {
    console.error('Erreur lors de la récupération des assignations:', error)
  }
}

const fetchAvailableVolunteers = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/volunteers/available`)
    availableVolunteers.value = response as unknown as AvailableVolunteer[]
  } catch (error) {
    console.error('Erreur lors de la récupération des bénévoles:', error)
  }
}

const assignVolunteer = async (userId: number) => {
  if (!formState.value.id) return

  try {
    assignmentLoading.value = true
    await $fetch<any>(
      `/api/editions/${props.editionId}/volunteer-time-slots/${formState.value.id}/assignments`,
      {
        method: 'POST',
        body: { userId },
      }
    )

    // Recharger les assignations
    await fetchAssignments()

    // Fermer le sélecteur
    showVolunteerSelector.value = false

    // Toast de succès
    // TODO: Ajouter toast
  } catch (error: any) {
    console.error("Erreur lors de l'assignation:", error)
    // TODO: Ajouter toast d'erreur
  } finally {
    assignmentLoading.value = false
  }
}

const unassignVolunteer = async (assignmentId: string) => {
  if (!formState.value.id) return

  try {
    assignmentLoading.value = true
    await $fetch(
      `/api/editions/${props.editionId}/volunteer-time-slots/${formState.value.id}/assignments/${assignmentId}`,
      {
        method: 'DELETE',
      }
    )

    // Recharger les assignations
    await fetchAssignments()

    // TODO: Ajouter toast de succès
  } catch (error: any) {
    console.error('Erreur lors de la désassignation:', error)
    // TODO: Ajouter toast d'erreur
  } finally {
    assignmentLoading.value = false
  }
}

// Charger les assignations à l'ouverture
watch(isOpen, (newValue) => {
  if (newValue) {
    if (formState.value.id) {
      fetchAssignments()
      fetchAvailableVolunteers()
    }
    if (!formState.value.id) {
      nextTick(() => {
        titleInput.value?.focus()
      })
    }
  }
})
</script>
