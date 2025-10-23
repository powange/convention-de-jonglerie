<template>
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
            @click="emit('refresh')"
          >
            {{ t('common.refresh') }}
          </UButton>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-heroicons-document-arrow-down"
            :loading="exportingPdf"
            @click="exportToPdf"
          >
            {{ t('editions.volunteers.export_pdf') }}
          </UButton>
        </div>
        <div class="flex items-center gap-4">
          <!-- Filtre par équipes -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Équipes :</span>
            <USelect
              v-model="selectedTeams"
              :items="teamFilterOptions"
              option-attribute="label"
              value-attribute="value"
              multiple
              size="sm"
              class="min-w-[200px]"
              :placeholder="t('editions.volunteers.all_teams')"
            />
          </div>
          <!-- Sélecteur de granularité -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Granularité :</span>
            <USelect
              v-model="selectedGranularity"
              :items="granularityOptions"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="min-w-[120px]"
            />
          </div>
          <span v-if="canManageVolunteers" class="text-xs text-gray-500">
            {{ t('editions.volunteers.planning_tip') }}
          </span>
        </div>
      </div>

      <!-- Calendrier de planning -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <UiLazyFullCalendar
          v-if="ready && calendarOptions && edition"
          ref="calendarRef"
          :options="calendarOptions"
          class="volunteer-planning-calendar"
        />
        <div v-else class="flex items-center justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
          <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { VolunteerTimeSlot, VolunteerTeamCalendar } from '~/composables/useVolunteerSchedule'
import type { Edition } from '~/types'
import type { VolunteerStats, DayStats, VolunteerStatsIndividual } from '~/utils/volunteer-stats'

interface Props {
  edition: Edition | undefined
  teams?: any[]
  timeSlots?: any[]
  canManageVolunteers: boolean
  refreshing?: boolean
  volunteersStats?: VolunteerStats
  volunteersStatsByDay?: DayStats[]
  volunteersStatsIndividual?: VolunteerStatsIndividual[]
  formatDate: (date: string) => string
  formatDateTimeRange: (start: string, end: string) => string
  currentUserId?: number // Pour filtrer les stats si c'est un bénévole
}

interface SlotCreateData {
  start: string
  end: string
  teamId: string
}

interface SlotUpdateData {
  id: string
  title: string
  description?: string
  teamId?: string
  start: string
  end: string
  maxVolunteers: number
}

interface Emits {
  (e: 'create-slot', data: SlotCreateData): void
  (e: 'refresh' | 'export-pdf'): void
  (e: 'slot-click', slot: any): void
  (e: 'slot-update', data: SlotUpdateData): void
  (e: 'slot-delete', slotId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()
const calendarRef = ref<any>()

// Récupération automatique des teams et timeSlots si non fournis
const editionId = computed(() => props.edition?.id)

// Toujours récupérer les données via les composables
const { teams: fetchedTeams } = useVolunteerTeams(editionId)
const { timeSlots: fetchedTimeSlots } = useVolunteerTimeSlots(editionId)

// Utiliser les props si fournis, sinon les données récupérées
const internalTeams = computed(() => props.teams ?? fetchedTeams.value)
const internalTimeSlots = computed(() => props.timeSlots ?? fetchedTimeSlots.value)

// État local pour les filtres et l'export
const selectedTeams = ref<string[]>([])
const selectedGranularity = ref(30)
const exportingPdf = ref(false)

// Options de granularité
const granularityOptions = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '60 minutes', value: 60 },
]

// Options pour le filtre d'équipes
const teamFilterOptions = computed(() => {
  if (!internalTeams.value) return []

  return internalTeams.value.map((team) => ({
    label: team.name,
    value: team.id,
  }))
})

// Conversion des données API pour compatibilité avec FullCalendar
const convertedTimeSlots = computed(() => {
  return internalTimeSlots.value.map(
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
      assignedVolunteersList: [...(slot.assignments || [])], // Copie directe des assignments
    })
  )
})

// Calcul automatique des stats individuelles si non fournies (pour les bénévoles)
const computedStatsIndividual = computed((): VolunteerStatsIndividual[] => {
  // Si fourni en prop, l'utiliser
  if (props.volunteersStatsIndividual) {
    return props.volunteersStatsIndividual
  }

  // Sinon, si c'est un bénévole, calculer ses stats à partir des créneaux
  if (props.currentUserId && !props.canManageVolunteers) {
    let userInfo: any = null
    const myStats = {
      user: { id: props.currentUserId, pseudo: '', prenom: '', nom: '' },
      totalHours: 0,
      totalSlots: 0,
      dayDetails: new Map<string, any>(),
    }

    convertedTimeSlots.value.forEach((slot) => {
      const myAssignment = slot.assignedVolunteersList?.find(
        (a: any) => a.user.id === props.currentUserId
      )

      if (myAssignment) {
        // Récupérer les infos utilisateur depuis le premier assignment trouvé
        if (!userInfo && myAssignment.user) {
          userInfo = myAssignment.user
          myStats.user = userInfo
        }

        const startTime = new Date(slot.start)
        const endTime = new Date(slot.end)
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
        const dayKey = startTime.toISOString().split('T')[0]

        myStats.totalHours += hours
        myStats.totalSlots += 1

        if (!myStats.dayDetails.has(dayKey)) {
          myStats.dayDetails.set(dayKey, {
            date: dayKey,
            hours: 0,
            slots: 0,
          })
        }

        const dayDetail = myStats.dayDetails.get(dayKey)
        dayDetail.hours += hours
        dayDetail.slots += 1
      }
    })

    return [
      {
        ...myStats,
        dayDetails: Array.from(myStats.dayDetails.values()).sort((a: any, b: any) =>
          a.date.localeCompare(b.date)
        ),
      },
    ]
  }

  return []
})

const convertedTeams = computed(() => {
  return internalTeams.value.map(
    (team): VolunteerTeamCalendar => ({
      id: team.id,
      name: team.name,
      color: team.color,
    })
  )
})

// Équipes filtrées selon la sélection
const filteredTeams = computed(() => {
  let teams = convertedTeams.value

  // Filtrer selon la sélection manuelle d'équipes
  if (selectedTeams.value.length > 0) {
    teams = teams.filter((team) => selectedTeams.value.includes(team.id))
  }

  // Si l'utilisateur n'a pas les droits de gestion, masquer les équipes sans créneaux
  if (!props.canManageVolunteers) {
    teams = teams.filter((team) => {
      // Vérifier si cette équipe a au moins un créneau
      return convertedTimeSlots.value.some((slot) => slot.teamId === team.id)
    })
  }

  return teams
})

// Créneaux filtrés selon les équipes sélectionnées
const filteredTimeSlots = computed(() => {
  if (selectedTeams.value.length === 0) {
    return convertedTimeSlots.value
  }

  return convertedTimeSlots.value.filter(
    (slot) => !slot.teamId || selectedTeams.value.includes(slot.teamId)
  )
})

// Computed pour les dates avec fallbacks
// Utilise les dates de montage/démontage si définies, sinon les dates de l'édition
const editionStartDate = computed(() => {
  if (props.edition?.volunteersSetupStartDate) {
    return props.edition.volunteersSetupStartDate.split('T')[0]
  }
  return (props.edition?.startDate || new Date().toISOString().split('T')[0]) as string
})

const editionEndDate = computed(() => {
  let endDate: string
  if (props.edition?.volunteersTeardownEndDate) {
    endDate = props.edition.volunteersTeardownEndDate.split('T')[0]
  } else {
    endDate = (props.edition?.endDate || new Date().toISOString().split('T')[0]) as string
  }

  // Ajouter un jour à la date de fin car validRange.end est exclusif dans FullCalendar
  const date = new Date(endDate)
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
})

// Configuration du calendrier de planning
const { calendarOptions, ready } = useVolunteerSchedule({
  editionStartDate: editionStartDate,
  editionEndDate: editionEndDate,
  teams: filteredTeams,
  timeSlots: filteredTimeSlots,
  readOnly: computed(() => !props.canManageVolunteers),
  slotDuration: computed(() => selectedGranularity.value),
  onTimeSlotCreate: (start, end, resourceId) => {
    emit('create-slot', {
      start,
      end,
      teamId: resourceId === 'unassigned' ? '' : resourceId,
    })
  },
  onTimeSlotClick: (timeSlot: VolunteerTimeSlot) => {
    const existingSlot = internalTimeSlots.value.find((s) => s.id === timeSlot.id)
    if (existingSlot) {
      emit('slot-click', existingSlot)
    }
  },
  onTimeSlotUpdate: async (timeSlot) => {
    emit('slot-update', {
      id: timeSlot.id,
      title: timeSlot.title,
      description: timeSlot.description ?? undefined,
      teamId: timeSlot.teamId ?? undefined,
      start: timeSlot.start,
      end: timeSlot.end,
      maxVolunteers: timeSlot.maxVolunteers,
    })
  },
  onTimeSlotDelete: async (timeSlotId) => {
    emit('slot-delete', timeSlotId)
  },
})

// Fonction pour ouvrir le modal de création de créneau
const openCreateSlotModal = () => {
  const defaultStart = props.edition?.startDate ? `${props.edition.startDate}T09:00` : ''
  const defaultEnd = props.edition?.startDate ? `${props.edition.startDate}T10:00` : ''
  emit('create-slot', {
    start: defaultStart,
    end: defaultEnd,
    teamId: '',
  })
}

// Fonction d'export PDF
const exportToPdf = async () => {
  exportingPdf.value = true
  try {
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let currentY = margin

    // Déterminer si on filtre pour un bénévole spécifique
    const isVolunteerView = props.currentUserId && !props.canManageVolunteers

    // Filtrer les stats individuelles si c'est un bénévole
    const filteredStatsIndividual = isVolunteerView
      ? computedStatsIndividual.value.filter((v) => v.user.id === props.currentUserId)
      : computedStatsIndividual.value

    // En-tête du document
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    const title = isVolunteerView
      ? `Mon planning - ${props.edition?.name || 'Édition'}`
      : `Planning des bénévoles - ${props.edition?.name || 'Édition'}`
    doc.text(title, margin, currentY)
    currentY += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const subtitle = `${props.edition?.convention?.name || ''} - ${props.formatDateTimeRange(props.edition?.startDate || '', props.edition?.endDate || '')}`
    doc.text(subtitle, margin, currentY)
    currentY += 15

    // Statistiques (adaptées pour bénévole)
    if (isVolunteerView && filteredStatsIndividual.length > 0) {
      const myStats = filteredStatsIndividual[0]
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Mes statistiques', margin, currentY)
      currentY += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const stats = [
        `Heures totales : ${myStats.totalHours.toFixed(1)}h`,
        `Nombre de créneaux : ${myStats.totalSlots}`,
      ]

      stats.forEach((stat) => {
        doc.text(stat, margin, currentY)
        currentY += 6
      })
      currentY += 10
    } else if (!isVolunteerView) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Statistiques générales', margin, currentY)
      currentY += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const stats = [
        `Nombre total de bénévoles : ${props.volunteersStats?.totalVolunteers || 0}`,
        `Heures totales de bénévolat : ${props.volunteersStats?.totalHours.toFixed(1) || '0.0'}h`,
        `Moyenne d'heures par bénévole : ${props.volunteersStats?.averageHours.toFixed(1) || '0.0'}h`,
        `Nombre total de créneaux : ${props.volunteersStats?.totalSlots || 0}`,
      ]

      stats.forEach((stat) => {
        doc.text(stat, margin, currentY)
        currentY += 6
      })
      currentY += 10
    }

    // Fonction pour vérifier si on a besoin d'une nouvelle page
    const checkNewPage = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - margin) {
        doc.addPage()
        currentY = margin
      }
    }

    // Planning par jour (uniquement pour gestionnaires)
    if (!isVolunteerView && props.volunteersStatsByDay && props.volunteersStatsByDay.length > 0) {
      checkNewPage(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Planning par jour', margin, currentY)
      currentY += 10

      props.volunteersStatsByDay.forEach((dayStats) => {
        checkNewPage(30 + dayStats.volunteers.length * 5)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`${props.formatDate(dayStats.date)}`, margin, currentY)
        currentY += 6

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `${dayStats.totalVolunteers} bénévoles - ${dayStats.totalHours.toFixed(1)}h total`,
          margin + 5,
          currentY
        )
        currentY += 8

        // Liste des bénévoles pour ce jour
        dayStats.volunteers.forEach((volunteer: any) => {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          const volunteerLine = `• ${volunteer.user.pseudo} : ${volunteer.hours.toFixed(1)}h (${volunteer.slots} créneaux)`
          doc.text(volunteerLine, margin + 10, currentY)
          currentY += 5
        })
        currentY += 5
      })
    }

    // Statistiques individuelles (seulement pour gestionnaires ou détails du bénévole)
    if (filteredStatsIndividual.length > 0) {
      if (!isVolunteerView) {
        doc.addPage()
        currentY = margin
      }

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(isVolunteerView ? 'Mes créneaux' : 'Statistiques par bénévole', margin, currentY)
      currentY += 10

      filteredStatsIndividual.forEach((volunteerStat) => {
        checkNewPage(15 + (volunteerStat.dayDetails?.length || 0) * 4)

        if (!isVolunteerView) {
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          const volunteerName = `${volunteerStat.user.pseudo} (${volunteerStat.user.prenom || ''} ${volunteerStat.user.nom || ''})`
          doc.text(volunteerName, margin, currentY)
          currentY += 6
        }

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Total : ${volunteerStat.totalHours.toFixed(1)}h sur ${volunteerStat.totalSlots} créneaux`,
          margin + 5,
          currentY
        )
        currentY += 5

        // Détails par jour
        if (volunteerStat.dayDetails && volunteerStat.dayDetails.length > 0) {
          volunteerStat.dayDetails.forEach((dayDetail: any) => {
            const dayLine = `  ${props.formatDate(dayDetail.date)} : ${dayDetail.hours.toFixed(1)}h (${dayDetail.slots} créneaux)`
            doc.text(dayLine, margin + 10, currentY)
            currentY += 4
          })
        } else {
          doc.text('  Aucun créneau assigné', margin + 10, currentY)
          currentY += 4
        }
        currentY += 3
      })
    }

    // Télécharger le PDF
    const fileName = `planning-benevoles-${props.edition?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'edition'}.pdf`
    doc.save(fileName)

    toast.add({
      title: t('editions.volunteers.pdf_exported'),
      description: t('editions.volunteers.pdf_downloaded'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error("Erreur lors de l'export PDF:", error)
    toast.add({
      title: t('errors.error_occurred'),
      description: "Erreur lors de l'export PDF",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    exportingPdf.value = false
  }
}

// Exposer la référence du calendrier pour permettre l'accès depuis le parent
defineExpose({
  calendarRef,
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

/* Dark mode support avec toggle manuel Nuxt UI */
.dark .volunteer-planning-calendar {
  --fc-border-color: rgb(55 65 81); /* gray-700 */
  --fc-neutral-bg-color: rgb(31 41 55); /* gray-800 */
}

.dark .volunteer-planning-calendar .fc-theme-standard .fc-resource-timeline-divider {
  border-color: rgb(55 65 81);
}

.dark .volunteer-planning-calendar .fc-theme-standard .fc-scrollgrid {
  border-color: rgb(55 65 81);
}

.dark .volunteer-planning-calendar .fc-theme-standard td,
.dark .volunteer-planning-calendar .fc-theme-standard th {
  border-color: rgb(55 65 81);
}

.dark .volunteer-planning-calendar .fc-resource {
  background-color: rgb(31 41 55);
  color: rgb(243 244 246);
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
