<template>
  <div>
    <div v-if="initialLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-calendar-days" class="text-orange-600 dark:text-orange-400" />
          Planning des bénévoles
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Planifier les créneaux et missions des bénévoles
        </p>
      </div>

      <div class="space-y-6">
        <!-- Contenu du planning -->
        <EditionVolunteerPlanningCard
          :edition="edition"
          :teams="teams"
          :time-slots="timeSlots"
          :can-manage-volunteers="canManageVolunteers"
          :refreshing="refreshing"
          :volunteers-stats="volunteersStats"
          :volunteers-stats-by-day="volunteersStatsByDay"
          :volunteers-stats-individual="volunteersStatsIndividual"
          :format-date="formatDate"
          :format-date-time-range="formatDateTimeRange"
          @create-slot="handleCreateSlot"
          @slot-click="handleSlotClick"
          @slot-update="handleSlotUpdate"
          @slot-delete="handleSlotDelete"
          @refresh="refreshData"
        />

        <!-- Alerte pour les chevauchements de créneaux -->
        <EditionVolunteerPlanningOverlapWarningsAlert
          :overlap-warnings="overlapWarnings"
          :preference-warnings="preferenceWarnings"
          :meal-time-warnings="mealTimeWarnings"
          :can-manage-volunteers="canManageVolunteers"
          :format-date-time-range="formatDateTimeRange"
        />

        <!-- Panneau d'auto-assignation -->
        <AutoAssignmentPanel
          v-if="canManageVolunteers"
          :edition-id="editionId"
          :volunteers="acceptedVolunteers"
          :time-slots="convertedTimeSlots"
          :teams="[...teams]"
          class="mt-6"
          @assignments-applied="refreshData"
        />

        <!-- Résumé des bénévoles par jour -->
        <EditionVolunteerPlanningVolunteersSummary
          :can-manage-volunteers="canManageVolunteers"
          :volunteers-stats="volunteersStats"
          :volunteers-stats-by-day="volunteersStatsByDay"
          :volunteers-stats-individual="volunteersStatsIndividual"
          :active-stats-tab="activeStatsTab"
          :format-date="formatDate"
        />
      </div>

      <!-- Modal de détails du créneau (point d'entrée) -->
      <EditionVolunteerPlanningSlotDetailsModal
        v-model="slotDetailsModalOpen"
        :time-slot="selectedTimeSlot"
        :teams="[...teams]"
        :read-only="!canManageVolunteers"
        @edit-slot="handleEditSlotFromDetails"
        @manage-assignments="handleManageAssignments"
        @manage-delay="handleManageDelay"
      />

      <!-- Modal de gestion des assignations -->
      <EditionVolunteerPlanningAssignmentsModal
        v-model="assignmentsModalOpen"
        :edition-id="editionId"
        :time-slot="selectedTimeSlot"
        @refresh="refreshData"
      />

      <!-- Modal de gestion des retards -->
      <EditionVolunteerPlanningDelayModal
        v-model="delayModalOpen"
        :edition-id="editionId"
        :time-slot="selectedTimeSlot"
        @refresh="refreshData"
      />

      <!-- Modal de création/édition de créneau -->
      <SlotModal
        v-model="slotModalOpen"
        :teams="[...teams]"
        :edition-id="editionId"
        :initial-slot="slotModalData"
        @save="handleSlotSave"
        @delete="handleSlotDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import AutoAssignmentPanel from '~/components/edition/volunteer/AutoAssignmentPanel.vue'
import SlotModal from '~/components/edition/volunteer/planning/SlotModal.vue'
import { useDatetime } from '~/composables/useDatetime'
import type { VolunteerTimeSlot, VolunteerTeamCalendar } from '~/composables/useVolunteerSchedule'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import {
  calculateVolunteersStats,
  calculateVolunteersStatsByDay,
  calculateVolunteersStatsIndividual,
} from '~/utils/volunteer-stats'

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { toDatetimeLocal } = useDatetime()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// État du composant
const refreshing = ref(false)
const initialLoading = ref(true)

// État des onglets de statistiques
const activeStatsTab = ref('hours-per-volunteer') // heures par bénévole par défaut

// Données des bénévoles
const volunteers = ref<any[]>([]) // Applications de bénévoles

// État des modals
const slotDetailsModalOpen = ref(false)
const selectedTimeSlot = ref<any>(null)
const assignmentsModalOpen = ref(false)
const delayModalOpen = ref(false)
const slotModalOpen = ref(false)
const slotModalData = ref<any>(null)

// Utilisation des vraies APIs
const { teams, fetchTeams } = useVolunteerTeams(editionId)
const { timeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot, fetchTimeSlots } =
  useVolunteerTimeSlots(editionId)

// Conversion des données API pour compatibilité avec FullCalendar
const convertedTimeSlots = computed(() => {
  return timeSlots.value.map(
    (slot): VolunteerTimeSlot => ({
      id: slot.id,
      title: slot.title,
      start: slot.start,
      end: slot.end,
      teamId: slot.teamId,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot.assignedVolunteers,
      color: slot.color,
      description: slot.description,
      delayMinutes: slot.delayMinutes,
      assignedVolunteersList: [...(slot.assignments || [])], // Copie directe des assignments
      editionId, // Ajouter l'editionId au slot
    })
  )
})

const convertedTeams = computed(() => {
  return teams.value.map(
    (team): VolunteerTeamCalendar => ({
      id: team.id,
      name: team.name,
      color: team.color,
    })
  )
})

// Permissions calculées
const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Handlers pour les événements du composant de planning
const handleCreateSlot = (data: { start: string; end: string; teamId: string }) => {
  slotModalData.value = {
    title: '',
    description: '',
    teamId: data.teamId || '',
    startDateTime: toDatetimeLocal(data.start),
    endDateTime: toDatetimeLocal(data.end),
    maxVolunteers: 3,
  }
  slotModalOpen.value = true
}

const handleSlotClick = (slot: any) => {
  // Ouvrir la modal de détails (point d'entrée)
  selectedTimeSlot.value = slot
  slotDetailsModalOpen.value = true
}

const handleEditSlotFromDetails = () => {
  // Préparer les données pour la modal d'édition
  if (selectedTimeSlot.value) {
    slotModalData.value = {
      id: selectedTimeSlot.value.id,
      title: selectedTimeSlot.value.title,
      description: selectedTimeSlot.value.description || '',
      teamId: selectedTimeSlot.value.teamId || '',
      startDateTime: toDatetimeLocal(selectedTimeSlot.value.start),
      endDateTime: toDatetimeLocal(selectedTimeSlot.value.end),
      maxVolunteers: selectedTimeSlot.value.maxVolunteers,
    }
    slotModalOpen.value = true
  }
}

const handleManageAssignments = () => {
  assignmentsModalOpen.value = true
}

const handleManageDelay = () => {
  delayModalOpen.value = true
}

const handleSlotUpdate = async (data: {
  id: string
  title: string
  description?: string
  teamId?: string
  start: string
  end: string
  maxVolunteers: number
}) => {
  try {
    await updateTimeSlot(data.id, {
      title: data.title,
      description: data.description,
      teamId: data.teamId,
      startDateTime: data.start,
      endDateTime: data.end,
      maxVolunteers: data.maxVolunteers,
    })
    toast.add({
      title: t('edition.volunteers.slot_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string; statusText?: string }
    toast.add({
      title: t('errors.error_occurred'),
      description:
        err.data?.message || err.message || err.statusText || 'Erreur lors de la mise à jour',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const handleSlotDelete = async (slotId: string) => {
  if (confirm(t('edition.volunteers.confirm_delete_slot'))) {
    try {
      await deleteTimeSlot(slotId)
      toast.add({
        title: t('edition.volunteers.slot_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string; statusText?: string }
      toast.add({
        title: t('errors.error_occurred'),
        description:
          err.data?.message || err.message || err.statusText || 'Erreur lors de la suppression',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

// Handlers pour la modal
const handleSlotSave = async (slotData: any) => {
  try {
    if (slotData.id) {
      // Mise à jour d'un créneau existant
      await updateTimeSlot(slotData.id, {
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
      })
      toast.add({
        title: t('edition.volunteers.slot_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Création d'un nouveau créneau
      await createTimeSlot({
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
      })
      toast.add({
        title: t('edition.volunteers.slot_created'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string; statusText?: string }
    toast.add({
      title: t('errors.error_occurred'),
      description:
        err.data?.message || err.message || err.statusText || 'Erreur lors de la sauvegarde',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const refreshData = async () => {
  refreshing.value = true
  try {
    // Recharger les données depuis l'API en utilisant les fonctions déjà définies
    await Promise.all([fetchTeams(), fetchTimeSlots(), fetchAcceptedVolunteers()])
  } catch {
    toast.add({
      title: t('errors.error_occurred'),
      description: 'Erreur lors du rechargement des données',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    refreshing.value = false
  }
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) {
    return true
  }

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) {
    return true
  }

  // Tous les organisateurs de la convention (même sans droits)
  if (isOrganizer.value) {
    return true
  }

  return false
})

// Fonction utilitaire pour formater les dates
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

// Fonction utilitaire pour formater une plage horaire avec le jour
const formatDateTimeRange = (start: string, end: string) => {
  // Parse les dates en tant que dates locales (sans conversion de timezone)
  const startTime = new Date(start.includes('T') ? start : start + 'T00:00:00')
  const endTime = new Date(end.includes('T') ? end : end + 'T00:00:00')

  // Extraire les composants directement pour éviter les conversions de timezone
  const startYear = startTime.getFullYear()
  const startMonth = startTime.getMonth()
  const startDate = startTime.getDate()
  const startHours = startTime.getHours()
  const startMinutes = startTime.getMinutes()

  const endYear = endTime.getFullYear()
  const endMonth = endTime.getMonth()
  const endDate = endTime.getDate()
  const endHours = endTime.getHours()
  const endMinutes = endTime.getMinutes()

  // Créer une date locale pour le formatage du jour
  const startDateLocal = new Date(startYear, startMonth, startDate)
  const endDateLocal = new Date(endYear, endMonth, endDate)

  // Format pour le jour
  const dayFormat = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  // Formater les heures manuellement
  const formatTime = (hours: number, minutes: number) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const startDay = dayFormat.format(startDateLocal)
  const startTimeStr = formatTime(startHours, startMinutes)
  const endTimeStr = formatTime(endHours, endMinutes)

  // Si c'est le même jour, on affiche le jour une seule fois
  if (startDateLocal.toDateString() === endDateLocal.toDateString()) {
    return `${startDay} ${startTimeStr} - ${endTimeStr}`
  } else {
    // Si les créneaux sont sur des jours différents
    const endDay = dayFormat.format(endDateLocal)
    return `${startDay} ${startTimeStr} - ${endDay} ${endTimeStr}`
  }
}

// Détection des chevauchements de créneaux
const overlapWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot1: any
    slot2: any
  }> = []

  // Regrouper tous les créneaux par bénévole
  const volunteerSlots = new Map<number, Array<{ slot: any; assignment: any }>>()

  convertedTimeSlots.value.forEach((slot) => {
    // Vérifications basiques seulement
    if (!slot || !slot.id) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id
      if (!volunteerSlots.has(userId)) {
        volunteerSlots.set(userId, [])
      }
      volunteerSlots.get(userId)!.push({ slot, assignment })
    })
  })

  // Vérifier les chevauchements pour chaque bénévole
  volunteerSlots.forEach((slots, volunteerId) => {
    if (slots.length < 2) return // Pas de chevauchement possible avec moins de 2 créneaux

    // Comparer tous les couples de créneaux
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i]?.slot
        const slot2 = slots[j]?.slot

        // Vérifications minimales
        if (!slot1 || !slot2 || slot1.id === slot2.id) continue

        // Vérifier si les créneaux se chevauchent
        const start1 = new Date(slot1.start)
        const end1 = new Date(slot1.end)
        const start2 = new Date(slot2.start)
        const end2 = new Date(slot2.end)

        // Condition de chevauchement : start1 < end2 && start2 < end1
        if (start1 < end2 && start2 < end1) {
          // Trouver les noms des équipes
          const team1 = convertedTeams.value.find((t) => t.id === slot1.teamId)
          const team2 = convertedTeams.value.find((t) => t.id === slot2.teamId)

          warnings.push({
            volunteerId,
            volunteer: slots[i]?.assignment?.user,
            slot1: {
              id: slot1.id,
              title: slot1.title || 'Sans titre',
              start: slot1.start,
              end: slot1.end,
              teamName: team1?.name || null,
            },
            slot2: {
              id: slot2.id,
              title: slot2.title || 'Sans titre',
              start: slot2.start,
              end: slot2.end,
              teamName: team2?.name || null,
            },
          })
        }
      }
    }
  })

  return warnings
})

// Détection des conflits de préférences d'équipe
const preferenceWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot: any
    teamName: string
  }> = []

  // Créer un map des préférences d'équipe par bénévole
  const volunteerTeamPreferences = new Map<number, string[]>()
  acceptedVolunteers.value.forEach((volunteer) => {
    if (volunteer.teamPreferences && Array.isArray(volunteer.teamPreferences)) {
      volunteerTeamPreferences.set(volunteer.user.id, volunteer.teamPreferences)
    }
  })

  // Vérifier chaque assignation
  convertedTimeSlots.value.forEach((slot) => {
    if (!slot || !slot.id || !slot.teamId) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id
      const preferences = volunteerTeamPreferences.get(userId)

      // Si le bénévole a des préférences d'équipe et que l'équipe du créneau n'en fait pas partie
      if (preferences && preferences.length > 0 && !preferences.includes(slot.teamId)) {
        const team = convertedTeams.value.find((t) => t.id === slot.teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            start: slot.start,
            end: slot.end,
            teamName: team?.name || null,
          },
          teamName: team?.name || 'Équipe inconnue',
        })
      }
    })
  })

  return warnings
})

// Détection des conflits de repas (créneaux qui empêchent de manger)
const mealTimeWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot: any
    mealPeriod: 'lunch' | 'dinner'
  }> = []

  // Définir les périodes de repas
  const LUNCH_START = { hour: 11, minute: 30 }
  const LUNCH_END = { hour: 14, minute: 0 }
  const DINNER_START = { hour: 19, minute: 30 }
  const DINNER_END = { hour: 22, minute: 0 }

  // Fonction pour vérifier si un créneau couvre entièrement une période de repas
  const coversEntireMealPeriod = (
    slotStart: string,
    slotEnd: string,
    mealStart: { hour: number; minute: number },
    mealEnd: { hour: number; minute: number }
  ) => {
    const start = new Date(slotStart)
    const end = new Date(slotEnd)

    const mealStartTime = new Date(start)
    mealStartTime.setHours(mealStart.hour, mealStart.minute, 0, 0)

    const mealEndTime = new Date(start)
    mealEndTime.setHours(mealEnd.hour, mealEnd.minute, 0, 0)

    // Le créneau couvre la période de repas s'il commence avant ou au début du repas
    // et se termine après ou à la fin du repas
    return start <= mealStartTime && end >= mealEndTime
  }

  // Vérifier chaque assignation
  convertedTimeSlots.value.forEach((slot) => {
    if (!slot || !slot.id) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id

      // Vérifier si le créneau couvre la période du déjeuner
      if (coversEntireMealPeriod(slot.start, slot.end, LUNCH_START, LUNCH_END)) {
        const team = convertedTeams.value.find((t) => t.id === slot.teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            start: slot.start,
            end: slot.end,
            teamName: team?.name || null,
          },
          mealPeriod: 'lunch',
        })
      }

      // Vérifier si le créneau couvre la période du dîner
      if (coversEntireMealPeriod(slot.start, slot.end, DINNER_START, DINNER_END)) {
        const team = convertedTeams.value.find((t) => t.id === slot.teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            start: slot.start,
            end: slot.end,
            teamName: team?.name || null,
          },
          mealPeriod: 'dinner',
        })
      }
    })
  })

  return warnings
})

// Données pour le composant d'auto-assignation
const acceptedVolunteers = computed(() => {
  if (!volunteers.value || !Array.isArray(volunteers.value)) {
    return []
  }
  return volunteers.value.filter((v) => v.status === 'ACCEPTED')
})

// Fonction pour récupérer les bénévoles acceptés
const fetchAcceptedVolunteers = async () => {
  try {
    const response: any = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: { status: 'ACCEPTED' },
    })
    // L'API retourne { success: true, data: [...], pagination: {...} }
    const applications = response.data || response.applications || response
    volunteers.value = Array.isArray(applications) ? applications : []
  } catch {
    volunteers.value = []
  }
}

// Calcul des statistiques des bénévoles en utilisant les utilitaires
const volunteersStats = computed(() =>
  calculateVolunteersStats(convertedTimeSlots.value, acceptedVolunteers.value)
)

const volunteersStatsByDay = computed(() => calculateVolunteersStatsByDay(convertedTimeSlots.value))

const volunteersStatsIndividual = computed(() =>
  calculateVolunteersStatsIndividual(convertedTimeSlots.value, acceptedVolunteers.value)
)

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const isOrganizer = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

// Charger l'édition si nécessaire
onMounted(async () => {
  try {
    await Promise.all([
      edition.value ? Promise.resolve() : editionStore.fetchEditionById(editionId, { force: true }),
      fetchAcceptedVolunteers(),
      fetchTeams(),
      fetchTimeSlots(),
    ])
  } catch {
    toast.add({
      title: t('errors.error_occurred'),
      description: t('edition.volunteers.loading_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    initialLoading.value = false
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Planning des bénévoles - ' + (edition.value?.name || 'Édition'),
  description: 'Planification des créneaux et missions des bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
