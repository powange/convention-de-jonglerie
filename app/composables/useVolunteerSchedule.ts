import allLocales from '@fullcalendar/core/locales-all'
import interactionPlugin from '@fullcalendar/interaction'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import timelinePlugin from '@fullcalendar/timeline'

// Import supprimé car non utilisé directement dans ce fichier
import type { CalendarOptions, EventInput, ResourceInput } from '@fullcalendar/core'
import type { ComputedRef, Ref } from 'vue'

// Type simplifié pour FullCalendar (compatible avec VolunteerTeam)
export interface VolunteerTeamCalendar {
  id: string
  name: string
  color: string
}

export interface VolunteerTimeSlot {
  id: string
  title: string
  start: string
  end: string
  teamId?: string
  maxVolunteers: number
  assignedVolunteers: number
  color?: string
  description?: string
}

// VolunteerTeam est importé depuis useVolunteerTeams.ts

export interface UseVolunteerScheduleOptions {
  editionStartDate: string
  editionEndDate: string
  teams: Ref<VolunteerTeamCalendar[]> | ComputedRef<VolunteerTeamCalendar[]>
  timeSlots: Ref<VolunteerTimeSlot[]> | ComputedRef<VolunteerTimeSlot[]>
  onTimeSlotCreate?: (start: string, end: string, resourceId?: string) => void
  onTimeSlotUpdate?: (timeSlot: VolunteerTimeSlot) => void
  onTimeSlotClick?: (timeSlot: VolunteerTimeSlot) => void
  onTimeSlotDelete?: (timeSlotId: string) => void
}

export function useVolunteerSchedule(options: UseVolunteerScheduleOptions) {
  const { t, locale } = useI18n()

  const {
    editionStartDate,
    editionEndDate,
    teams,
    timeSlots,
    onTimeSlotCreate,
    onTimeSlotUpdate,
    onTimeSlotClick,
    onTimeSlotDelete: _onTimeSlotDelete,
  } = options

  const calendarRef = ref<any>(null)
  const ready = ref(false)

  // Configuration des ressources (équipes + "Non assigné")
  const resources = computed((): ResourceInput[] => {
    const teamResources: ResourceInput[] = unref(teams).map((team) => ({
      id: team.id,
      title: team.name,
      eventColor: team.color || '#3788d8',
    }))

    // Ajouter une ressource "Non assigné" pour les créneaux sans équipe
    return [
      {
        id: 'unassigned',
        title: t('editions.volunteers.unassigned_slots'),
        eventColor: '#6b7280', // gris
      },
      ...teamResources,
    ]
  })

  // Conversion des créneaux en événements FullCalendar
  const events = computed((): EventInput[] => {
    return unref(timeSlots).map((slot) => ({
      id: slot.id,
      title: `${slot.title} (${slot.assignedVolunteers}/${slot.maxVolunteers})`,
      start: slot.start,
      end: slot.end,
      resourceId: slot.teamId || 'unassigned',
      color: slot.color,
      extendedProps: {
        description: slot.description,
        maxVolunteers: slot.maxVolunteers,
        assignedVolunteers: slot.assignedVolunteers,
        teamId: slot.teamId,
      },
    }))
  })

  // Configuration du calendrier
  const calendarOptions = reactive<CalendarOptions>({
    plugins: [resourceTimelinePlugin, timelinePlugin, interactionPlugin],
    locales: allLocales,
    locale: locale.value,

    // Vue timeline par ressource
    initialView: 'resourceTimelineWeek',

    // Période visible
    validRange: {
      start: editionStartDate,
      end: editionEndDate,
    },

    // Configuration temporelle
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '00:15:00', // Granularité 15 minutes
    slotLabelInterval: '01:00:00', // Libellés toutes les heures

    // Configuration des ressources
    resources: [],

    // Configuration des événements
    events: [],
    editable: true,
    selectable: true,

    // Hauteur du calendrier
    height: 'auto',

    // Configuration de l'affichage
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'resourceTimelineDay,resourceTimelineWeek',
    },

    // Textes des boutons
    buttonText: {
      today: t('common.today'),
      day: t('common.day'),
      week: t('common.week'),
      resourceTimelineDay: t('editions.volunteers.day_view'),
      resourceTimelineWeek: t('editions.volunteers.week_view'),
    },

    // Gestion des clics et sélections
    select: (selectInfo) => {
      if (onTimeSlotCreate) {
        onTimeSlotCreate(selectInfo.startStr, selectInfo.endStr, selectInfo.resource?.id)
      }
      // Désélectionner après la création
      nextTick(() => {
        if (calendarRef.value && calendarRef.value.getApi) {
          calendarRef.value.getApi().unselect()
        }
      })
    },

    // Gestion des événements
    eventClick: (info) => {
      // Appeler le callback pour le clic si fourni, sinon utiliser onTimeSlotUpdate
      const callback = onTimeSlotClick || onTimeSlotUpdate
      if (callback) {
        const event = info.event
        const slot: VolunteerTimeSlot = {
          id: event.id,
          title: event.title.split(' (')[0], // Enlever le compteur
          start: event.startStr,
          end: event.endStr,
          teamId: event.extendedProps.teamId,
          maxVolunteers: event.extendedProps.maxVolunteers,
          assignedVolunteers: event.extendedProps.assignedVolunteers,
          color: event.backgroundColor || event.color,
          description: event.extendedProps.description,
        }
        callback(slot)
      }
    },

    // Drag & drop des événements
    eventDrop: (info) => {
      const event = info.event
      const updatedSlot: VolunteerTimeSlot = {
        id: event.id,
        title: event.title.split(' (')[0], // Enlever le compteur
        start: event.startStr,
        end: event.endStr,
        teamId:
          event.getResources()[0]?.id === 'unassigned' ? undefined : event.getResources()[0]?.id,
        maxVolunteers: event.extendedProps.maxVolunteers,
        assignedVolunteers: event.extendedProps.assignedVolunteers,
        color: event.color,
        description: event.extendedProps.description,
      }

      if (onTimeSlotUpdate) {
        onTimeSlotUpdate(updatedSlot)
      }
    },

    // Redimensionnement des événements
    eventResize: (info) => {
      const event = info.event
      const updatedSlot: VolunteerTimeSlot = {
        id: event.id,
        title: event.title.split(' (')[0],
        start: event.startStr,
        end: event.endStr,
        teamId:
          event.getResources()[0]?.id === 'unassigned' ? undefined : event.getResources()[0]?.id,
        maxVolunteers: event.extendedProps.maxVolunteers,
        assignedVolunteers: event.extendedProps.assignedVolunteers,
        color: event.color,
        description: event.extendedProps.description,
      }

      if (onTimeSlotUpdate) {
        onTimeSlotUpdate(updatedSlot)
      }
    },
  })

  // Watchers pour mettre à jour les ressources et événements
  watch(
    resources,
    (newResources) => {
      calendarOptions.resources = newResources
    },
    { deep: true, immediate: true }
  )

  watch(
    events,
    (newEvents) => {
      calendarOptions.events = newEvents
    },
    { deep: true, immediate: true }
  )

  // Initialisation
  onMounted(() => {
    nextTick(() => {
      ready.value = true
    })
  })

  return {
    calendarRef,
    calendarOptions,
    ready,
  }
}
