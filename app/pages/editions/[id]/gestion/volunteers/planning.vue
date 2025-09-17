<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader
        :edition="edition"
        current-page="gestion"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

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

      <!-- Contenu du planning -->
      <UCard variant="soft">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-calendar-days" class="text-primary-500" />
              {{ t('editions.volunteers.schedule_management') }}
            </h3>
          </div>
        </template>

        <div class="space-y-6">
          <!-- Barre d'outils -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <UButton
                v-if="canManageVolunteers"
                size="sm"
                color="primary"
                icon="i-heroicons-plus"
                @click="openCreateSlotModal"
              >
                {{ t('editions.volunteers.create_time_slot') }}
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-heroicons-arrow-path"
                :loading="refreshing"
                @click="refreshData"
              >
                {{ t('common.refresh') }}
              </UButton>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">
                {{ t('editions.volunteers.planning_tip') }}
              </span>
            </div>
          </div>

          <!-- Calendrier de planning -->
          <div
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div v-if="!ready || !edition" class="flex items-center justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
              <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
            </div>
            <FullCalendar
              v-else-if="calendarOptions && edition"
              ref="calendarRef"
              :options="calendarOptions"
              class="volunteer-planning-calendar"
            />
          </div>
        </div>
      </UCard>

      <!-- Alerte pour les chevauchements de créneaux -->
      <UAlert
        v-if="overlapWarnings.length > 0"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        class="mt-6"
      >
        <template #title>
          {{ t('editions.volunteers.scheduling_conflicts') || 'Conflits de planning détectés' }}
        </template>
        <template #description>
          <div class="space-y-2">
            <p class="text-sm">
              {{ overlapWarnings.length }} bénévole(s) ont des créneaux qui se chevauchent :
            </p>
            <div class="space-y-1">
              <div
                v-for="warning in overlapWarnings"
                :key="`${warning.volunteerId}-${warning.slot1.id}-${warning.slot2.id}`"
                class="text-sm bg-amber-50 dark:bg-amber-900/20 p-2 rounded border-l-2 border-amber-400"
              >
                <div class="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                  <UiUserAvatar :user="warning.volunteer" size="xs" />
                  {{ warning.volunteer.pseudo }}
                </div>
                <div class="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  <strong>{{ warning.slot1.title }}</strong>
                  <span v-if="warning.slot1.teamName" class="text-amber-600 dark:text-amber-400">
                    - {{ warning.slot1.teamName }}</span
                  >
                  <br />
                  ({{ formatDateTimeRange(warning.slot1.start, warning.slot1.end) }})
                  <br />
                  <strong>{{ warning.slot2.title }}</strong>
                  <span v-if="warning.slot2.teamName" class="text-amber-600 dark:text-amber-400">
                    - {{ warning.slot2.teamName }}</span
                  >
                  <br />
                  ({{ formatDateTimeRange(warning.slot2.start, warning.slot2.end) }})
                </div>
              </div>
            </div>
          </div>
        </template>
      </UAlert>

      <!-- Résumé des bénévoles par jour -->
      <UCard v-if="volunteersStats.totalVolunteers > 0" variant="soft" class="mt-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-primary-500" />
              {{ t('editions.volunteers.volunteers_summary') }}
            </h3>
            <UBadge color="primary" variant="soft">
              {{ volunteersStats.totalVolunteers }} {{ t('editions.volunteers.volunteers') }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Résumé global -->
          <div
            class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="text-center">
              <div class="text-2xl font-bold text-primary-600">
                {{ volunteersStats.totalHours.toFixed(1) }}h
              </div>
              <div class="text-sm text-gray-500">{{ t('editions.volunteers.total_hours') }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">
                {{ volunteersStats.averageHours.toFixed(1) }}h
              </div>
              <div class="text-sm text-gray-500">
                {{ t('editions.volunteers.average_per_volunteer') }}
              </div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">{{ volunteersStats.totalSlots }}</div>
              <div class="text-sm text-gray-500">
                {{ t('editions.volunteers.total_assignments') }}
              </div>
            </div>
          </div>

          <!-- Détail par jour -->
          <div class="space-y-3">
            <h4 class="font-medium text-gray-900 dark:text-white">
              {{ t('editions.volunteers.hours_per_day') }}
            </h4>
            <div class="space-y-2">
              <div
                v-for="dayStats in volunteersStatsByDay"
                :key="dayStats.date"
                class="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div class="flex items-center justify-between mb-3">
                  <h5 class="font-medium text-gray-900 dark:text-white">
                    {{ formatDate(dayStats.date) }}
                  </h5>
                  <div class="flex items-center gap-2">
                    <UBadge color="gray" variant="soft" size="sm">
                      {{ dayStats.totalVolunteers }} {{ t('editions.volunteers.volunteers_short') }}
                    </UBadge>
                    <UBadge color="primary" variant="soft" size="sm">
                      {{ dayStats.totalHours.toFixed(1) }}h
                    </UBadge>
                  </div>
                </div>

                <div class="space-y-1">
                  <div
                    v-for="volunteerStat in dayStats.volunteers"
                    :key="`${dayStats.date}-${volunteerStat.user.id}`"
                    class="flex items-center justify-between text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <UiUserAvatar :user="volunteerStat.user" size="xs" />
                      <span class="text-gray-700 dark:text-gray-300">{{
                        volunteerStat.user.pseudo
                      }}</span>
                      <span
                        v-if="volunteerStat.user.prenom || volunteerStat.user.nom"
                        class="text-gray-500 text-xs"
                      >
                        ({{ volunteerStat.user.prenom }} {{ volunteerStat.user.nom }})
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400"
                        >{{ volunteerStat.hours.toFixed(1) }}h</span
                      >
                      <UBadge color="gray" variant="soft" size="xs">
                        {{ volunteerStat.slots }} {{ t('editions.volunteers.slots_short') }}
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Modal de création/édition de créneau -->
      <SlotModal
        v-model="slotModalOpen"
        :teams="teams"
        :edition-id="editionId"
        :initial-slot="slotModalData"
        @save="handleSlotSave"
        @delete="handleSlotDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import FullCalendar from '@fullcalendar/vue3'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import SlotModal from '~/components/edition/volunteer/planning/SlotModal.vue'
import { useDatetime } from '~/composables/useDatetime'
import type { VolunteerTimeSlot, VolunteerTeamCalendar } from '~/composables/useVolunteerSchedule'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

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

// État de la modal
const slotModalOpen = ref(false)
const slotModalData = ref<any>(null)

// Utilisation des vraies APIs
const { teams } = useVolunteerTeams(editionId)
const { timeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } =
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
      assignedVolunteersList: slot.assignments || [], // Mapping des assignments vers assignedVolunteersList
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

// Computed pour les dates avec fallbacks
const editionStartDate = computed(
  () => edition.value?.startDate || new Date().toISOString().split('T')[0]
)
const editionEndDate = computed(
  () => edition.value?.endDate || new Date().toISOString().split('T')[0]
)

// Configuration du calendrier de planning
const { calendarRef, calendarOptions, ready } = useVolunteerSchedule({
  editionStartDate: editionStartDate,
  editionEndDate: editionEndDate,
  teams: convertedTeams,
  timeSlots: convertedTimeSlots,
  onTimeSlotCreate: (start, end, resourceId) => {
    // Ouvrir la modal avec les dates pré-remplies
    openSlotModal({
      start,
      end,
      teamId: resourceId === 'unassigned' ? '' : resourceId,
    })
  },
  onTimeSlotClick: (timeSlot: VolunteerTimeSlot) => {
    // Ouvrir la modal en mode édition lors d'un clic
    const existingSlot = timeSlots.value.find((s) => s.id === timeSlot.id)
    if (existingSlot) {
      slotModalData.value = {
        id: existingSlot.id,
        title: existingSlot.title,
        description: existingSlot.description || '',
        teamId: existingSlot.teamId || '',
        startDateTime: toDatetimeLocal(existingSlot.start),
        endDateTime: toDatetimeLocal(existingSlot.end),
        maxVolunteers: existingSlot.maxVolunteers,
      }
      slotModalOpen.value = true
    }
  },
  onTimeSlotUpdate: async (timeSlot) => {
    // Mise à jour directe lors du drag & drop ou resize
    try {
      await updateTimeSlot(timeSlot.id, {
        title: timeSlot.title,
        description: timeSlot.description,
        teamId: timeSlot.teamId || undefined,
        startDateTime: timeSlot.start,
        endDateTime: timeSlot.end,
        maxVolunteers: timeSlot.maxVolunteers,
      })
      toast.add({
        title: t('editions.volunteers.slot_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du créneau:', error)

      const errorMessage =
        error.data?.message || error.message || error.statusText || 'Erreur lors de la mise à jour'

      toast.add({
        title: t('errors.error_occurred'),
        description: errorMessage,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  },
  onTimeSlotDelete: async (timeSlotId) => {
    if (confirm(t('editions.volunteers.confirm_delete_slot'))) {
      try {
        await deleteTimeSlot(timeSlotId)
        toast.add({
          title: t('editions.volunteers.slot_deleted'),
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
      } catch (error: any) {
        console.error('Erreur lors de la suppression du créneau:', error)

        const errorMessage =
          error.data?.message ||
          error.message ||
          error.statusText ||
          'Erreur lors de la suppression'

        toast.add({
          title: t('errors.error_occurred'),
          description: errorMessage,
          icon: 'i-heroicons-x-circle',
          color: 'error',
        })
      }
    }
  },
})

// Actions de la modal
const openSlotModal = (initialData?: { start?: string; end?: string; teamId?: string }) => {
  // Définir les données initiales
  slotModalData.value = {
    title: '',
    description: '',
    teamId: initialData?.teamId || '',
    startDateTime: toDatetimeLocal(initialData?.start || ''),
    endDateTime: toDatetimeLocal(initialData?.end || ''),
    maxVolunteers: 3,
  }
  slotModalOpen.value = true
}

const openCreateSlotModal = () => {
  // Utiliser les dates de l'édition par défaut
  const defaultStart = edition.value?.startDate ? `${edition.value.startDate}T09:00` : ''
  const defaultEnd = edition.value?.startDate ? `${edition.value.startDate}T10:00` : ''
  openSlotModal({
    start: defaultStart,
    end: defaultEnd,
  })
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
        title: t('editions.volunteers.slot_updated'),
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
        title: t('editions.volunteers.slot_created'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
  } catch (error: any) {
    console.error('Erreur lors de la sauvegarde du créneau:', error)

    // Extraire le message d'erreur approprié
    const errorMessage =
      error.data?.message || // Message de l'API
      error.message || // Message de l'erreur standard
      error.statusText || // Texte du statut HTTP
      'Erreur lors de la sauvegarde'

    toast.add({
      title: t('errors.error_occurred'),
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const handleSlotDelete = async (slotId: string) => {
  try {
    await deleteTimeSlot(slotId)
    toast.add({
      title: t('editions.volunteers.slot_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Erreur lors de la suppression du créneau:', error)

    const errorMessage =
      error.data?.message || error.message || error.statusText || 'Erreur lors de la suppression'

    toast.add({
      title: t('errors.error_occurred'),
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const refreshData = async () => {
  refreshing.value = true
  try {
    // Recharger les données depuis l'API
    const { fetchTeams } = useVolunteerTeams(editionId)
    const { fetchTimeSlots } = useVolunteerTimeSlots(editionId)

    await Promise.all([fetchTeams(), fetchTimeSlots()])
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
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
})

// Fonction utilitaire pour formater les dates
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
        const slot1 = slots[i].slot
        const slot2 = slots[j].slot

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
            volunteer: slots[i].assignment.user,
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

// Calcul des statistiques des bénévoles
const volunteersStats = computed(() => {
  const slotsWithAssignments = convertedTimeSlots.value.filter(
    (slot) => slot.assignedVolunteersList && slot.assignedVolunteersList.length > 0
  )

  if (slotsWithAssignments.length === 0) {
    return {
      totalVolunteers: 0,
      totalHours: 0,
      averageHours: 0,
      totalSlots: 0,
    }
  }

  const volunteerHours = new Map<number, number>()
  const volunteerSlots = new Map<number, number>()
  let totalHours = 0
  let totalSlots = 0

  slotsWithAssignments.forEach((slot) => {
    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

    slot.assignedVolunteersList?.forEach((assignment) => {
      const userId = assignment.user.id
      volunteerHours.set(userId, (volunteerHours.get(userId) || 0) + hours)
      volunteerSlots.set(userId, (volunteerSlots.get(userId) || 0) + 1)
      totalHours += hours
      totalSlots += 1
    })
  })

  const totalVolunteers = volunteerHours.size
  const averageHours = totalVolunteers > 0 ? totalHours / totalVolunteers : 0

  return {
    totalVolunteers,
    totalHours,
    averageHours,
    totalSlots,
  }
})

// Statistiques par jour
const volunteersStatsByDay = computed(() => {
  const dayStats = new Map<string, any>()

  convertedTimeSlots.value.forEach((slot) => {
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const dayKey = startTime.toISOString().split('T')[0] // YYYY-MM-DD

    if (!dayStats.has(dayKey)) {
      dayStats.set(dayKey, {
        date: dayKey,
        volunteers: new Map<number, any>(),
        totalHours: 0,
        totalVolunteers: 0,
      })
    }

    const day = dayStats.get(dayKey)

    slot.assignedVolunteersList.forEach((assignment) => {
      const userId = assignment.user.id

      if (!day.volunteers.has(userId)) {
        day.volunteers.set(userId, {
          user: assignment.user,
          hours: 0,
          slots: 0,
        })
      }

      const volunteerStat = day.volunteers.get(userId)
      volunteerStat.hours += hours
      volunteerStat.slots += 1
      day.totalHours += hours
    })

    day.totalVolunteers = day.volunteers.size
  })

  // Convertir en array et trier par date
  return Array.from(dayStats.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      volunteers: Array.from(day.volunteers.values()).sort((a, b) => b.hours - a.hours), // Trier par heures décroissantes
    }))
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.message || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Planning des bénévoles - ' + (edition.value?.name || 'Édition'),
  description: 'Planification des créneaux et missions des bénévoles',
})
</script>

<style>
/* Styles pour le planning des bénévoles */
.volunteer-planning-calendar {
  /* Timeline resource view styling */
  --fc-border-color: rgb(229 231 235); /* gray-200 */
  --fc-neutral-bg-color: rgb(249 250 251); /* gray-50 */
}

.volunteer-planning-calendar .fc-theme-standard .fc-resource-timeline-divider {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-theme-standard .fc-scrollgrid {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-theme-standard td,
.volunteer-planning-calendar .fc-theme-standard th {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-resource {
  background-color: rgb(249 250 251);
  color: rgb(17 24 39);
}

.volunteer-planning-calendar .fc-event {
  border: 1px solid;
  border-radius: 0.375rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  font-size: 0.875rem;
  cursor: pointer;
}

.volunteer-planning-calendar .fc-event-title {
  white-space: pre-line;
  line-height: 1.3;
  padding: 2px 4px;
  font-size: 0.75rem;
}

.volunteer-planning-calendar .fc-event-main {
  padding: 1px 2px;
}

/* Styles pour le contenu personnalisé des événements */
.volunteer-planning-calendar .volunteer-slot-content {
  padding: 2px 4px;
  font-size: 0.75rem;
  line-height: 1.2;
}

.volunteer-planning-calendar .slot-title {
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.volunteer-planning-calendar .slot-avatars {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
}

.volunteer-planning-calendar .volunteer-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
  line-height: 1.2;
}

.volunteer-planning-calendar .user-avatar {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: rgb(99 102 241); /* indigo-500 */
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.45rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.volunteer-planning-calendar .volunteer-text {
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.volunteer-planning-calendar .user-avatar-1 {
  background-color: rgb(34 197 94); /* green-500 */
}

.volunteer-planning-calendar .user-avatar-2 {
  background-color: rgb(251 146 60); /* orange-400 */
}

.volunteer-planning-calendar .user-avatar-3 {
  background-color: rgb(168 85 247); /* purple-500 */
}

.volunteer-planning-calendar .user-avatar-4 {
  background-color: rgb(236 72 153); /* pink-500 */
}

.volunteer-planning-calendar .fc-event:hover {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .volunteer-planning-calendar {
    --fc-border-color: rgb(55 65 81); /* gray-700 */
    --fc-neutral-bg-color: rgb(31 41 55); /* gray-800 */
  }

  .volunteer-planning-calendar .fc-theme-standard .fc-resource-timeline-divider {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-theme-standard .fc-scrollgrid {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-theme-standard td,
  .volunteer-planning-calendar .fc-theme-standard th {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-resource {
    background-color: rgb(31 41 55);
    color: rgb(243 244 246);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .volunteer-planning-calendar .fc-toolbar {
    flex-direction: column;
    gap: 0.5rem;
  }

  .volunteer-planning-calendar .fc-toolbar-chunk {
    display: flex;
    justify-content: center;
  }
}
</style>
