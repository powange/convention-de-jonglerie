<template>
  <UCollapsible class="flex flex-col gap-2 w-full">
    <UButton
      :label="t('editions.volunteers.auto_assignment.title')"
      color="neutral"
      variant="subtle"
      trailing-icon="i-heroicons-sparkles"
      block
    />
    <template #content>
      <UCard variant="soft">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-primary-500" />
              {{ t('editions.volunteers.auto_assignment.title') }}
            </h3>
            <UBadge color="warning" variant="soft" size="sm">
              {{ t('editions.volunteers.auto_assignment.beta_badge') }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-6">
          <!-- Description -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              {{ t('editions.volunteers.auto_assignment.description') }}
            </p>
          </div>

          <!-- Contraintes -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField
              :label="t('editions.volunteers.auto_assignment.hours_per_volunteer')"
              :help="t('editions.volunteers.auto_assignment.hours_per_volunteer_help')"
            >
              <UFieldGroup>
                <UButton
                  :label="t('editions.volunteers.auto_assignment.minimum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.minHoursPerVolunteer"
                  type="number"
                  min="0"
                  max="12"
                  :placeholder="t('editions.volunteers.auto_assignment.min_placeholder')"
                />
                <UButton
                  :label="t('editions.volunteers.auto_assignment.maximum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.maxHoursPerVolunteer"
                  type="number"
                  min="1"
                  max="24"
                  :placeholder="t('editions.volunteers.auto_assignment.max_placeholder')"
                />
              </UFieldGroup>
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.hours_per_day')"
              :help="t('editions.volunteers.auto_assignment.hours_per_day_help')"
            >
              <UFieldGroup>
                <UButton
                  :label="t('editions.volunteers.auto_assignment.minimum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.minHoursPerDay"
                  type="number"
                  min="0"
                  max="8"
                  :placeholder="t('editions.volunteers.auto_assignment.min_placeholder')"
                />
                <UButton
                  :label="t('editions.volunteers.auto_assignment.maximum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.maxHoursPerDay"
                  type="number"
                  min="1"
                  max="12"
                  :placeholder="t('editions.volunteers.auto_assignment.max_placeholder')"
                />
              </UFieldGroup>
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.balance_teams')"
              :help="t('editions.volunteers.auto_assignment.balance_teams_help')"
            >
              <USwitch v-model="constraints.balanceTeams" />
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.prioritize_experience')"
              :help="t('editions.volunteers.auto_assignment.prioritize_experience_help')"
            >
              <USwitch v-model="constraints.prioritizeExperience" />
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.respect_availability')"
              :help="t('editions.volunteers.auto_assignment.respect_availability_help')"
            >
              <USwitch v-model="constraints.respectStrictAvailability" />
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.allow_overtime')"
              :help="t('editions.volunteers.auto_assignment.allow_overtime_help')"
            >
              <USwitch v-model="constraints.allowOvertime" />
            </UFormField>

            <UFormField
              :label="t('editions.volunteers.auto_assignment.keep_existing')"
              :help="t('editions.volunteers.auto_assignment.keep_existing_help')"
            >
              <USwitch v-model="constraints.keepExistingAssignments" />
            </UFormField>
          </div>

          <!-- Heures supplémentaires maximum (si activées) -->
          <UFormField
            v-if="constraints.allowOvertime"
            :label="t('editions.volunteers.auto_assignment.max_overtime_hours')"
            :help="t('editions.volunteers.auto_assignment.max_overtime_help_detailed')"
          >
            <UInput
              v-model="constraints.maxOvertimeHours"
              type="number"
              min="0"
              max="6"
              :placeholder="t('editions.volunteers.auto_assignment.max_overtime_placeholder')"
            />
          </UFormField>

          <!-- Boutons d'action -->
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-eye"
              :loading="previewLoading"
              @click="generatePreview"
            >
              {{ t('editions.volunteers.auto_assignment.preview') }}
            </UButton>

            <UButton
              v-if="previewResult"
              color="primary"
              icon="i-heroicons-check"
              :loading="applyLoading"
              @click="applyAssignments"
            >
              {{ t('editions.volunteers.auto_assignment.apply') }}
            </UButton>

            <UButton
              v-if="previewResult"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="clearPreview"
            >
              {{ t('common.cancel') }}
            </UButton>
          </div>

          <!-- Résultats de l'aperçu -->
          <div v-if="previewResult" class="space-y-4">
            <UDivider :label="t('editions.volunteers.auto_assignment.preview_results')" />

            <!-- Statistiques -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-green-600">
                  {{ previewResult.result.assignments.length }}
                </div>
                <div class="text-sm text-green-700 dark:text-green-300">
                  {{ t('editions.volunteers.auto_assignment.total_assignments') }}
                </div>
              </div>

              <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-blue-600">
                  {{ previewResult.result.stats.averageHoursPerVolunteer.toFixed(1) }}h
                </div>
                <div class="text-sm text-blue-700 dark:text-blue-300">
                  {{ t('editions.volunteers.auto_assignment.average_hours') }}
                </div>
              </div>

              <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-purple-600">
                  {{ Math.round(previewResult.result.stats.satisfactionRate * 100) }}%
                </div>
                <div class="text-sm text-purple-700 dark:text-purple-300">
                  {{ t('editions.volunteers.auto_assignment.satisfaction_rate') }}
                </div>
              </div>

              <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-orange-600">
                  {{ Math.round(previewResult.result.stats.balanceScore * 100) }}%
                </div>
                <div class="text-sm text-orange-700 dark:text-orange-300">
                  {{ t('editions.volunteers.auto_assignment.balance_score') }}
                </div>
              </div>
            </div>

            <!-- Avertissements -->
            <div v-if="previewResult.result.warnings.length > 0">
              <UAlert
                color="warning"
                variant="soft"
                :title="t('editions.volunteers.auto_assignment.warnings')"
              >
                <ul class="list-disc list-inside space-y-1">
                  <li v-for="warning in previewResult.result.warnings" :key="warning">
                    {{ warning }}
                  </li>
                </ul>
              </UAlert>
            </div>

            <!-- Recommandations -->
            <div v-if="previewResult.result.recommendations.length > 0">
              <UAlert
                color="info"
                variant="soft"
                :title="t('editions.volunteers.auto_assignment.recommendations')"
              >
                <ul class="list-disc list-inside space-y-1">
                  <li
                    v-for="recommendation in previewResult.result.recommendations"
                    :key="recommendation"
                  >
                    {{ recommendation }}
                  </li>
                </ul>
              </UAlert>
            </div>

            <!-- Détails des assignations -->
            <UCard>
              <template #header>
                <h4 class="font-medium">
                  {{ t('editions.volunteers.auto_assignment.assignment_details') }}
                </h4>
              </template>

              <div class="space-y-2 max-h-60 overflow-y-auto">
                <div
                  v-for="assignment in previewResult.result.assignments"
                  :key="`${assignment.volunteerId}-${assignment.slotId}`"
                  class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div class="flex items-center gap-2">
                    <UiUserAvatar :user="getVolunteerById(assignment.volunteerId)" size="xs" />
                    <span class="text-sm font-medium">
                      {{ getVolunteerById(assignment.volunteerId)?.pseudo }}
                    </span>
                    <UIcon name="i-heroicons-arrow-right" class="text-gray-400" size="14" />
                    <div class="flex flex-col">
                      <span class="text-sm font-medium">
                        {{ getSlotDisplayInfo(assignment.slotId).title }}
                      </span>
                      <span class="text-xs text-gray-500">
                        {{ getSlotDisplayInfo(assignment.slotId).timeRange }}
                      </span>
                      <span
                        v-if="getSlotDisplayInfo(assignment.slotId).team"
                        class="text-xs text-blue-600"
                      >
                        {{ getSlotDisplayInfo(assignment.slotId).team }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <UBadge
                      :color="getConfidenceColor(assignment.confidence)"
                      variant="soft"
                      size="xs"
                    >
                      {{ Math.round(assignment.confidence || 0) }}%
                    </UBadge>
                    <!-- Barre de progression -->
                    <UProgress
                      v-model="assignment.confidence"
                      :max="100"
                      :color="getConfidenceColor(assignment.confidence || 0)"
                      size="xs"
                      class="w-16"
                    />
                  </div>
                </div>
              </div>
            </UCard>

            <!-- Non assignés -->
            <div
              v-if="
                previewResult.result.unassigned.volunteers.length > 0 ||
                previewResult.result.unassigned.slots.length > 0
              "
            >
              <UCard>
                <template #header>
                  <h4 class="font-medium text-orange-600">
                    {{ t('editions.volunteers.auto_assignment.unassigned') }}
                  </h4>
                </template>

                <div class="space-y-4">
                  <div v-if="previewResult.result.unassigned.volunteers.length > 0">
                    <h5 class="text-sm font-medium mb-2">
                      {{ t('editions.volunteers.auto_assignment.unassigned_volunteers') }}
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="volunteerId in previewResult.result.unassigned.volunteers"
                        :key="volunteerId"
                        color="warning"
                        variant="soft"
                      >
                        {{ getVolunteerById(volunteerId)?.pseudo }}
                      </UBadge>
                    </div>
                  </div>

                  <div v-if="previewResult.result.unassigned.slots.length > 0">
                    <h5 class="text-sm font-medium mb-2">
                      {{ t('editions.volunteers.auto_assignment.unassigned_slots') }}
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="slotId in previewResult.result.unassigned.slots"
                        :key="slotId"
                        color="error"
                        variant="soft"
                        class="text-xs"
                      >
                        <div class="flex flex-col items-start">
                          <span class="font-medium">{{ getSlotDisplayInfo(slotId).title }}</span>
                          <span
                            v-if="getSlotDisplayInfo(slotId).timeRange"
                            class="text-xs opacity-80"
                          >
                            {{ getSlotDisplayInfo(slotId).timeRange }}
                          </span>
                        </div>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UCollapsible>
</template>

<script setup lang="ts">
interface Props {
  editionId: number
  volunteers: any[]
  timeSlots: any[]
  teams?: any[]
}

interface Constraints {
  maxHoursPerVolunteer: number
  minHoursPerVolunteer: number
  maxHoursPerDay: number
  minHoursPerDay: number
  balanceTeams: boolean
  prioritizeExperience: boolean
  respectStrictAvailability: boolean
  allowOvertime: boolean
  maxOvertimeHours: number
  keepExistingAssignments: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const toast = useToast()

// État réactif
const constraints = ref<Constraints>({
  maxHoursPerVolunteer: 8,
  minHoursPerVolunteer: 2,
  maxHoursPerDay: 6,
  minHoursPerDay: 1,
  balanceTeams: true,
  prioritizeExperience: true,
  respectStrictAvailability: true,
  allowOvertime: false,
  maxOvertimeHours: 2,
  keepExistingAssignments: false,
})

const previewLoading = ref(false)
const applyLoading = ref(false)
const previewResult = ref<any>(null)

// Fonctions utilitaires
const getVolunteerById = (id: number) => {
  return props.volunteers.find((v) => v.user.id === id)?.user
}

const getSlotById = (id: string | number) => {
  // Essayer de trouver le slot avec l'ID exact ou en convertissant les types
  return props.timeSlots.find(
    (s) => s.id === id || s.id === String(id) || String(s.id) === String(id)
  )
}

const getSlotDisplayInfo = (slotId: string | number) => {
  const slot = getSlotById(slotId)

  if (!slot) {
    return {
      title: `Créneau ${slotId} (non trouvé)`,
      timeRange: '',
      team: '',
    }
  }

  // Formatage de la date et de l'heure
  const startDate = slot.start ? new Date(slot.start) : null
  const endDate = slot.end ? new Date(slot.end) : null

  const startTime = startDate
    ? startDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  const endTime = endDate
    ? endDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  // Formatage de la date avec jour de la semaine
  const dateInfo = startDate
    ? startDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  const timeRange =
    startTime && endTime
      ? `${dateInfo} • ${startTime} - ${endTime}`
      : dateInfo || (startTime && endTime ? `${startTime} - ${endTime}` : '')

  // Nom de l'équipe si disponible
  const teamName = slot.teamId ? getTeamName(slot.teamId) : ''

  return {
    title: slot.title || 'Créneau sans titre',
    timeRange,
    team: teamName,
  }
}

const getTeamName = (teamId: string | number) => {
  if (!teamId || !props.teams) return ''

  const team = props.teams.find(
    (t) => t.id === teamId || t.id === String(teamId) || String(t.id) === String(teamId)
  )
  return team?.name || `Équipe ${teamId}`
}

const getConfidenceColor = (
  confidence: number
): 'warning' | 'primary' | 'secondary' | 'success' | 'info' | 'error' | 'neutral' | undefined => {
  if (confidence >= 80) return 'success'
  if (confidence >= 60) return 'info'
  if (confidence >= 40) return 'warning'
  return 'error'
}

// Actions
const generatePreview = async () => {
  previewLoading.value = true
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/volunteers/auto-assign`, {
      method: 'POST',
      body: {
        constraints: constraints.value,
        applyAssignments: false,
      },
    })

    previewResult.value = response

    toast.add({
      title: t('editions.volunteers.auto_assignment.preview_generated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error("Erreur lors de la génération de l'aperçu:", error)
    toast.add({
      title: t('errors.error_occurred'),
      description:
        error.data?.message || error.message || "Erreur lors de la génération de l'aperçu",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    previewLoading.value = false
  }
}

const applyAssignments = async () => {
  if (!previewResult.value) return

  // Confirmation avec modal plus détaillée
  const confirmed = await new Promise<boolean>((resolve) => {
    const assignmentsCount = previewResult.value?.result.assignments.length || 0
    const confirmKey = constraints.value.keepExistingAssignments
      ? 'editions.volunteers.auto_assignment.confirm_apply_keep_existing'
      : 'editions.volunteers.auto_assignment.confirm_apply'
    const message = `${t(confirmKey)}\n\n${t('editions.volunteers.auto_assignment.confirm_details', { count: assignmentsCount })}`

    resolve(confirm(message))
  })

  if (!confirmed) return

  applyLoading.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/volunteers/auto-assign`, {
      method: 'POST',
      body: {
        constraints: constraints.value,
        applyAssignments: true,
      },
    })

    toast.add({
      title: t('editions.volunteers.auto_assignment.assignments_applied'),
      description: t('editions.volunteers.auto_assignment.assignments_applied_description'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Nettoyer l'aperçu et recharger les données
    previewResult.value = null

    // Émettre un événement pour recharger les données de la page parente
    emit('assignments-applied')
  } catch (error: any) {
    console.error("Erreur lors de l'application des assignations:", error)
    toast.add({
      title: t('errors.error_occurred'),
      description:
        error.data?.message || error.message || "Erreur lors de l'application des assignations",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    applyLoading.value = false
  }
}

const clearPreview = () => {
  previewResult.value = null
}

// Émissions
const emit = defineEmits<{
  'assignments-applied': []
}>()
</script>
