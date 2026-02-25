<template>
  <UModal v-model:open="isOpen" size="lg" :title="modalTitle">
    <template #body>
      <div class="space-y-4">
        <!-- Info du créneau -->
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-4 h-4 text-green-600" />
              <h4 class="text-sm font-medium text-green-800 dark:text-green-200">
                {{ t('edition.volunteers.schedule_info') }}
              </h4>
            </div>
            <div v-if="duration" class="text-xs text-green-600 dark:text-green-400 font-medium">
              {{ duration }}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 pl-6">
            <div class="space-y-1">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.start') }}</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ formatDateTime(timeSlot?.start) }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.end') }}</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ formatDateTime(timeSlot?.end) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Section assignations -->
        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-plus" class="w-4 h-4 text-orange-600" />
              <h4 class="text-sm font-medium text-orange-800 dark:text-orange-200">
                {{ t('edition.volunteers.assigned_volunteers') }}
              </h4>
            </div>
            <UBadge color="warning" variant="soft" size="sm">
              {{ assignments.length }}/{{ timeSlot?.maxVolunteers || 0 }}
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
                :loading="isUnassigning(assignment.id)"
                @click="unassignVolunteer(assignment.id)"
              >
                {{ t('common.remove') }}
              </UButton>
            </div>
          </div>

          <div v-else class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            {{ t('edition.volunteers.no_assigned_volunteers') }}
          </div>

          <!-- Ajouter un bénévole -->
          <div v-if="assignments.length < (timeSlot?.maxVolunteers || 0)" class="border-t pt-3">
            <UButton
              color="warning"
              variant="soft"
              size="sm"
              icon="i-heroicons-plus"
              @click="showVolunteerSelector = true"
            >
              {{ t('edition.volunteers.add_volunteer') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal de sélection des bénévoles -->
  <UModal v-model:open="showVolunteerSelector" size="md">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-primary-600" />
        <h3 class="text-lg font-semibold">{{ t('edition.volunteers.select_volunteer') }}</h3>
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
            timeSlot?.teamId && timeSlot.teamId !== 'unassigned'
              ? t('edition.volunteers.no_volunteers_for_team')
              : t('edition.volunteers.no_available_volunteers')
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
                emailHash: volunteer.emailHash,
                profilePicture: volunteer.profilePicture,
                updatedAt: volunteer.updatedAt,
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
                {{ volunteer.assignmentsCount }} {{ t('edition.volunteers.current_assignments') }}
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            variant="soft"
            size="sm"
            @click="assignVolunteer(volunteer.userId)"
          >
            {{ t('edition.volunteers.assign') }}
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

import type { VolunteerTimeSlot } from '~/composables/useVolunteerSchedule'

// Props
interface Props {
  modelValue: boolean
  editionId: number
  timeSlot: VolunteerTimeSlot | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  refresh: []
}>()

// i18n
const { t } = useI18n()
const { formatForDisplay } = useDatetime()

// État
const showVolunteerSelector = ref(false)

interface Assignment {
  id: string
  user: {
    id: number
    pseudo: string
    nom: string | null
    prenom: string | null
    emailHash: string
    email?: string
    profilePicture: string | null
    updatedAt: string
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
  emailHash: string
  email?: string
  profilePicture: string | null
  updatedAt: string
  teamPreferences: any[]
  assignedTeams: string[]
  timePreferences: any[]
  skills: string[]
  currentAssignments: any[]
  assignmentsCount: number
}

const assignments = ref<Assignment[]>([])
const availableVolunteers = ref<AvailableVolunteer[]>([])

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const modalTitle = computed(() => {
  return props.timeSlot?.title || t('edition.volunteers.untitled_slot')
})

// Edition ID à utiliser (priorité à la prop, sinon le timeSlot.editionId)
const effectiveEditionId = computed(() => {
  return props.editionId || props.timeSlot?.editionId
})

// Durée
const duration = computed(() => {
  if (!props.timeSlot?.start || !props.timeSlot?.end) return null
  const start = new Date(props.timeSlot.start)
  const end = new Date(props.timeSlot.end)
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60

  if (hours > 0 && mins > 0) {
    return t('edition.volunteers.duration_hours_minutes', { hours, minutes: mins })
  } else if (hours > 0) {
    return t('edition.volunteers.duration_hours', { hours })
  } else {
    return t('edition.volunteers.duration_minutes', { minutes: mins })
  }
})

// Formatage de la date/heure
const formatDateTime = (dateTime: string | undefined) => {
  if (!dateTime) return '-'
  return formatForDisplay(new Date(dateTime))
}

// Bénévoles filtrés selon l'équipe du créneau et excluant ceux déjà assignés
const filteredAvailableVolunteers = computed(() => {
  const currentTeamId = props.timeSlot?.teamId === 'unassigned' ? null : props.timeSlot?.teamId
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

// Fonctions d'assignation
const fetchAssignments = async () => {
  if (!props.timeSlot?.id || !effectiveEditionId.value) {
    return
  }

  try {
    const response = await $fetch(
      `/api/editions/${effectiveEditionId.value}/volunteer-time-slots/${props.timeSlot.id}/assignments`
    )
    assignments.value = response as Assignment[]
  } catch (error) {
    console.error('Erreur lors de la récupération des assignations:', error)
  }
}

const fetchAvailableVolunteers = async () => {
  if (!effectiveEditionId.value) {
    return
  }

  try {
    const response = await $fetch(`/api/editions/${effectiveEditionId.value}/volunteers/available`)
    availableVolunteers.value = response as unknown as AvailableVolunteer[]
  } catch (error) {
    console.error('Erreur lors de la récupération des bénévoles:', error)
  }
}

const currentUserId = ref<number>()

const { execute: executeAssign, loading: assignmentLoading } = useApiAction(
  () =>
    `/api/editions/${effectiveEditionId.value}/volunteer-time-slots/${props.timeSlot?.id}/assignments`,
  {
    method: 'POST',
    body: () => ({ userId: currentUserId.value }),
    successMessage: { title: t('edition.volunteers.volunteer_assigned') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess: async () => {
      await fetchAssignments()
      showVolunteerSelector.value = false
      emit('refresh')
    },
  }
)

const assignVolunteer = (userId: number) => {
  if (!props.timeSlot?.id || !effectiveEditionId.value) return
  currentUserId.value = userId
  executeAssign()
}

const { execute: unassignVolunteer, isLoading: isUnassigning } = useApiActionById(
  (assignmentId) =>
    `/api/editions/${effectiveEditionId.value}/volunteer-time-slots/${props.timeSlot?.id}/assignments/${assignmentId}`,
  {
    method: 'DELETE',
    successMessage: { title: t('edition.volunteers.volunteer_unassigned') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess: async () => {
      await fetchAssignments()
      emit('refresh')
    },
  }
)

// Charger les assignations à l'ouverture
watch(
  [isOpen, () => props.timeSlot?.id],
  ([isOpenValue, slotId]) => {
    if (isOpenValue && slotId) {
      fetchAssignments()
      fetchAvailableVolunteers()
    }
  },
  { immediate: true }
)
</script>
