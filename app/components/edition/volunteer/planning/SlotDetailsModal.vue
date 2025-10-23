<template>
  <UModal v-model:open="isOpen" size="lg">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-full bg-primary-100 dark:bg-primary-900">
          <UIcon
            name="i-heroicons-information-circle"
            class="w-5 h-5 text-primary-600 dark:text-primary-400"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ timeSlot?.title || t('editions.volunteers.untitled_slot') }}
          </h3>
          <div class="flex items-center gap-2 mt-1">
            <div
              v-if="teamColor"
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :style="{ backgroundColor: teamColor }"
            ></div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ teamName || t('editions.volunteers.no_team') }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Description -->
        <div v-if="timeSlot?.description" class="space-y-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-gray-500" />
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('common.description') }}
            </h4>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 pl-6">
            {{ timeSlot.description }}
          </p>
        </div>

        <!-- Horaires -->
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-4 h-4 text-green-600" />
              <h4 class="text-sm font-medium text-green-800 dark:text-green-200">
                {{ t('editions.volunteers.schedule_info') }}
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

        <!-- Bénévoles assignés -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-users" class="w-4 h-4 text-purple-500" />
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('editions.volunteers.assigned_volunteers') }}
              </h4>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ assignments.length }}/{{ timeSlot?.maxVolunteers || 0 }}
            </span>
          </div>

          <div v-if="assignments.length > 0" class="space-y-2 pl-6">
            <div
              v-for="assignment in assignments"
              :key="assignment.id"
              class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            >
              <img
                v-if="assignment.user.profilePicture"
                :src="assignment.user.profilePicture"
                :alt="assignment.user.pseudo"
                class="w-8 h-8 rounded-full object-cover"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium"
              >
                {{ assignment.user.pseudo.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ assignment.user.pseudo }}
                </p>
                <p
                  v-if="assignment.user.nom || assignment.user.prenom"
                  class="text-xs text-gray-500 dark:text-gray-400 truncate"
                >
                  {{ [assignment.user.prenom, assignment.user.nom].filter(Boolean).join(' ') }}
                </p>
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-500 dark:text-gray-400 pl-6"
          >
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
            <span>{{ t('editions.volunteers.no_volunteers_assigned') }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        <UButton color="primary" @click="close">{{ t('common.close') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { VolunteerTimeSlot, VolunteerTeam } from '~/types/volunteer'

interface Assignment {
  id: string
  user: {
    id: number
    pseudo: string
    nom?: string
    prenom?: string
    profilePicture?: string
  }
  assignedBy?: {
    pseudo: string
  } | null
  assignedAt: Date
}

interface Props {
  modelValue: boolean
  timeSlot: VolunteerTimeSlot | null
  teams: VolunteerTeam[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const { formatForDisplay } = useDatetime()

// État de la modal
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Assignations
const assignments = ref<Assignment[]>([])

// Équipe
const teamName = computed(() => {
  if (!props.timeSlot?.teamId) return null
  const team = props.teams.find((t) => t.id === props.timeSlot?.teamId)
  return team?.name
})

const teamColor = computed(() => {
  if (!props.timeSlot?.teamId) return null
  const team = props.teams.find((t) => t.id === props.timeSlot?.teamId)
  return team?.color
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
    return t('editions.volunteers.duration_hours_minutes', { hours, minutes: mins })
  } else if (hours > 0) {
    return t('editions.volunteers.duration_hours', { hours })
  } else {
    return t('editions.volunteers.duration_minutes', { minutes: mins })
  }
})

// Formatage de la date/heure
const formatDateTime = (dateTime: string | undefined) => {
  if (!dateTime) return '-'
  return formatForDisplay(new Date(dateTime))
}

// Charger les assignations
const fetchAssignments = async () => {
  if (!props.timeSlot?.id) return

  // Si les assignations sont déjà fournies dans le slot, les utiliser directement
  if (
    props.timeSlot.assignedVolunteersList &&
    Array.isArray(props.timeSlot.assignedVolunteersList)
  ) {
    assignments.value = props.timeSlot.assignedVolunteersList.map((assignment: any) => ({
      id: assignment.id,
      user: assignment.user,
      assignedBy: assignment.assignedBy || null,
      assignedAt: assignment.assignedAt,
    }))
    return
  }

  // Sinon, charger depuis l'API (fallback)
  try {
    const data = await $fetch<any[]>(
      `/api/editions/${props.timeSlot.editionId}/volunteer-time-slots/${props.timeSlot.id}/assignments`
    )
    assignments.value = data
  } catch (error) {
    console.error('Erreur lors du chargement des assignations:', error)
    assignments.value = []
  }
}

// Fermer la modal
const close = () => {
  isOpen.value = false
}

// Watcher pour charger les assignations quand la modal s'ouvre
watch(
  () => props.timeSlot,
  (newSlot) => {
    if (newSlot) {
      fetchAssignments()
    } else {
      assignments.value = []
    }
  },
  { immediate: true, deep: true }
)
</script>
