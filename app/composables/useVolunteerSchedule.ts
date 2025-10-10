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
  title: string | null
  start: string
  end: string
  teamId?: string
  maxVolunteers: number
  assignedVolunteers: number
  color?: string
  description?: string
  assignedVolunteersList?: Array<{
    id: string
    user: {
      id: number
      pseudo: string
      nom: string | null
      prenom: string | null
      email: string
    }
  }>
}

// VolunteerTeam est importé depuis useVolunteerTeams.ts

export interface UseVolunteerScheduleOptions {
  editionStartDate: string | Ref<string> | ComputedRef<string>
  editionEndDate: string | Ref<string> | ComputedRef<string>
  teams: Ref<VolunteerTeamCalendar[]> | ComputedRef<VolunteerTeamCalendar[]>
  timeSlots: Ref<VolunteerTimeSlot[]> | ComputedRef<VolunteerTimeSlot[]>
  readOnly?: boolean | Ref<boolean> | ComputedRef<boolean>
  slotDuration?: number | Ref<number> | ComputedRef<number> // en minutes (15, 30, 60)
  onTimeSlotCreate?: (start: string, end: string, resourceId?: string) => void
  onTimeSlotUpdate?: (timeSlot: VolunteerTimeSlot) => void
  onTimeSlotClick?: (timeSlot: VolunteerTimeSlot) => void
  onTimeSlotDelete?: (timeSlotId: string) => void
}

export function useVolunteerSchedule(options: UseVolunteerScheduleOptions) {
  const { t, locale } = useI18n()

  const {
    teams,
    timeSlots,
    onTimeSlotCreate,
    onTimeSlotUpdate,
    onTimeSlotClick,
    onTimeSlotDelete: _onTimeSlotDelete,
  } = options

  // Computed pour les dates réactives
  const startDate = computed(() => unref(options.editionStartDate))
  const endDate = computed(() => unref(options.editionEndDate))
  const isReadOnly = computed(() => unref(options.readOnly) ?? false)
  const slotDurationMinutes = computed(() => unref(options.slotDuration) ?? 15)

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
    return unref(timeSlots).map((slot) => {
      const slotTitle = slot.title || t('editions.volunteers.untitled_slot')
      const counterInfo = `(${slot.assignedVolunteers}/${slot.maxVolunteers})`

      return {
        id: slot.id,
        title: `${slotTitle} ${counterInfo}`, // Titre simple pour les cas où eventContent n'est pas utilisé
        start: slot.start,
        end: slot.end,
        resourceId: slot.teamId || 'unassigned',
        color: slot.color,
        extendedProps: {
          description: slot.description,
          maxVolunteers: slot.maxVolunteers,
          assignedVolunteers: slot.assignedVolunteers,
          teamId: slot.teamId,
          assignedVolunteersList: slot.assignedVolunteersList,
          slotTitle, // Titre original pour eventContent
        },
      }
    })
  })

  // Calcul de l'heure de début pour l'affichage initial
  const initialScrollTime = computed(() => {
    const startDateValue = startDate.value
    if (startDateValue) {
      const date = new Date(startDateValue)
      // Extraire l'heure et retourner au format HH:MM:SS
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}:00`
    }
    return '08:00:00' // Fallback par défaut
  })

  // Configuration du calendrier
  const calendarOptions = reactive<CalendarOptions>({
    plugins: [resourceTimelinePlugin, timelinePlugin, interactionPlugin],
    locales: allLocales,
    locale: locale.value,

    // Vue timeline par ressource
    initialView: 'resourceTimelineWeek',

    // Date initiale (premier jour de l'événement)
    initialDate: startDate.value,

    // Période visible (limite la navigation)
    validRange: {
      start: startDate.value,
      end: endDate.value,
    },

    // Configuration temporelle
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: `00:${String(slotDurationMinutes.value).padStart(2, '0')}:00`, // Granularité dynamique
    slotLabelInterval: '01:00:00', // Libellés toutes les heures

    // Heure de défilement initial basée sur l'heure de début de l'édition
    scrollTime: initialScrollTime.value,

    // Configuration des ressources
    resources: [],

    // Configuration des événements
    events: [],
    editable: !isReadOnly.value,
    selectable: !isReadOnly.value,

    // Gestion des chevauchements
    eventOverlap: true, // Permet les chevauchements (par défaut: true)
    selectOverlap: true, // Permet la sélection sur des événements existants

    // Hauteur des ressources
    resourceAreaWidth: '15%', // Largeur de la colonne des équipes

    // Personnalisation de l'en-tête de la zone des ressources
    resourceAreaHeaderContent: t('editions.volunteers.teams'),

    // Hauteur du calendrier
    height: 'auto',

    // Configuration de l'affichage
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'resourceTimelineDay,resourceTimelineWeek',
    },

    // Format du titre principal pour afficher le nom du jour
    titleFormat: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },

    // Textes des boutons
    buttonText: {
      today: t('calendar.today'),
      day: t('common.day'),
      week: t('common.week'),
      resourceTimelineDay: t('editions.volunteers.day_view'),
      resourceTimelineWeek: t('editions.volunteers.week_view'),
    },

    // Format des en-têtes de jour avec nom du jour
    dayHeaderContent: (arg) => {
      const date = arg.date
      const formatter = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      return formatter.format(date)
    },

    // Configuration spécifique des vues
    views: {
      resourceTimelineDay: {
        slotLabelFormat: {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        },
      },
      resourceTimelineWeek: {
        dayHeaderContent: (arg) => {
          const date = arg.date
          const formatter = new Intl.DateTimeFormat('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
          return formatter.format(date)
        },
      },
    },

    // Rendu HTML personnalisé pour les événements
    eventContent: (arg) => {
      const event = arg.event
      const slotTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
      const counterInfo = `(${event.extendedProps.assignedVolunteers}/${event.extendedProps.maxVolunteers})`
      const assignedVolunteersList = event.extendedProps.assignedVolunteersList || []

      // Créer le conteneur principal
      const container = document.createElement('div')
      container.className = 'volunteer-slot-content'

      // Titre du créneau avec compteur
      const titleDiv = document.createElement('div')
      titleDiv.className = 'slot-title'
      titleDiv.textContent = `${slotTitle} ${counterInfo}`
      container.appendChild(titleDiv)

      // Section des avatars si il y a des bénévoles assignés
      if (assignedVolunteersList.length > 0) {
        const avatarsDiv = document.createElement('div')
        avatarsDiv.className = 'slot-avatars'

        assignedVolunteersList.forEach((assignment: any, index: number) => {
          const user = assignment.user
          const volunteerContainer = document.createElement('div')
          volunteerContainer.className = 'volunteer-item'

          // Créer l'avatar (image ou initiales)
          let avatar: HTMLElement

          // Déterminer l'URL de l'avatar
          let avatarUrl = ''
          if (user.profilePicture) {
            // Photo de profil personnalisée avec cache-busting
            const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now()
            avatarUrl = `${user.profilePicture}?v=${version}`
          } else if (user.emailHash) {
            // Gravatar via emailHash
            avatarUrl = `https://www.gravatar.com/avatar/${user.emailHash}?s=28&d=mp`
          }

          if (avatarUrl) {
            // Créer une image pour l'avatar
            avatar = document.createElement('img')
            avatar.setAttribute('src', avatarUrl)
            avatar.setAttribute('alt', user.pseudo || 'Avatar')
            avatar.className = 'user-avatar'
            avatar.style.width = '14px'
            avatar.style.height = '14px'
            avatar.style.borderRadius = '50%'
            avatar.style.objectFit = 'cover'
            avatar.style.border = '1px solid rgba(255, 255, 255, 0.8)'
            avatar.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)'
            avatar.style.flexShrink = '0'
          } else {
            // Fallback: créer un div avec initiales
            avatar = document.createElement('div')
            avatar.className = `user-avatar user-avatar-${index % 5}`

            // Initiales pour l'avatar
            let initials = ''
            if (user.pseudo) {
              initials = user.pseudo.substring(0, 2).toUpperCase()
            } else if (user.prenom || user.nom) {
              const firstName = user.prenom || ''
              const lastName = user.nom || ''
              initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
            } else {
              initials = 'U'
            }

            avatar.textContent = initials
          }

          // Créer le texte d'affichage
          const textSpan = document.createElement('span')
          textSpan.className = 'volunteer-text'

          const fullName = `${user.prenom || ''} ${user.nom || ''}`.trim()
          let displayText = user.pseudo || fullName || `Utilisateur ${user.id}`

          // Ajouter nom et prénom entre parenthèses si ils existent et si on a déjà un pseudo
          if (user.pseudo && fullName) {
            displayText = `${user.pseudo} (${fullName})`
          }

          textSpan.textContent = displayText

          volunteerContainer.appendChild(avatar)
          volunteerContainer.appendChild(textSpan)
          avatarsDiv.appendChild(volunteerContainer)
        })

        container.appendChild(avatarsDiv)
      }

      return { domNodes: [container] }
    },

    // Gestion des clics et sélections
    select: (selectInfo) => {
      if (!isReadOnly.value && onTimeSlotCreate) {
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
      // Ne pas déclencher les callbacks si en mode lecture seule
      if (isReadOnly.value) {
        return
      }

      // Appeler le callback pour le clic si fourni, sinon utiliser onTimeSlotUpdate
      const callback = onTimeSlotClick || onTimeSlotUpdate
      if (callback) {
        const event = info.event
        // Utiliser le titre original depuis extendedProps
        const rawTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
        const slot: VolunteerTimeSlot = {
          id: event.id,
          title: rawTitle === t('editions.volunteers.untitled_slot') ? null : rawTitle,
          start: event.startStr,
          end: event.endStr,
          teamId: event.extendedProps.teamId,
          maxVolunteers: event.extendedProps.maxVolunteers,
          assignedVolunteers: event.extendedProps.assignedVolunteers,
          color: event.backgroundColor || event.color,
          description: event.extendedProps.description,
          assignedVolunteersList: event.extendedProps.assignedVolunteersList,
        }
        callback(slot)
      }
    },

    // Drag & drop des événements
    eventDrop: (info) => {
      const event = info.event
      // Utiliser le titre original depuis extendedProps
      const rawTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
      const updatedSlot: VolunteerTimeSlot = {
        id: event.id,
        title: rawTitle === t('editions.volunteers.untitled_slot') ? null : rawTitle,
        start: event.startStr,
        end: event.endStr,
        teamId:
          event.getResources()[0]?.id === 'unassigned' ? undefined : event.getResources()[0]?.id,
        maxVolunteers: event.extendedProps.maxVolunteers,
        assignedVolunteers: event.extendedProps.assignedVolunteers,
        color: event.color,
        description: event.extendedProps.description,
        assignedVolunteersList: event.extendedProps.assignedVolunteersList,
      }

      if (onTimeSlotUpdate) {
        onTimeSlotUpdate(updatedSlot)
      }
    },

    // Redimensionnement des événements
    eventResize: (info) => {
      const event = info.event
      // Utiliser le titre original depuis extendedProps
      const rawTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
      const updatedSlot: VolunteerTimeSlot = {
        id: event.id,
        title: rawTitle === t('editions.volunteers.untitled_slot') ? null : rawTitle,
        start: event.startStr,
        end: event.endStr,
        teamId:
          event.getResources()[0]?.id === 'unassigned' ? undefined : event.getResources()[0]?.id,
        maxVolunteers: event.extendedProps.maxVolunteers,
        assignedVolunteers: event.extendedProps.assignedVolunteers,
        color: event.color,
        description: event.extendedProps.description,
        assignedVolunteersList: event.extendedProps.assignedVolunteersList,
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

  // Watcher pour les dates d'édition
  watch(
    [startDate, endDate],
    ([newStartDate, newEndDate]) => {
      if (newStartDate && newEndDate) {
        calendarOptions.initialDate = newStartDate
        calendarOptions.validRange = {
          start: newStartDate,
          end: newEndDate,
        }

        // Mettre à jour l'heure de défilement
        calendarOptions.scrollTime = initialScrollTime.value

        // Forcer la mise à jour du calendrier si il est déjà initialisé
        nextTick(() => {
          if (calendarRef.value && ready.value) {
            const calendarApi = calendarRef.value.getApi()
            if (calendarApi) {
              calendarApi.gotoDate(newStartDate)
              // Forcer le scroll à la bonne heure
              calendarApi.scrollToTime(initialScrollTime.value)
            }
          }
        })
      }
    },
    { immediate: true }
  )

  // Watcher pour la granularité
  watch(slotDurationMinutes, (newDuration) => {
    if (calendarRef.value && calendarRef.value.getApi) {
      const calendarApi = calendarRef.value.getApi()
      if (calendarApi) {
        // Mettre à jour la configuration de slotDuration
        calendarApi.setOption('slotDuration', `00:${String(newDuration).padStart(2, '0')}:00`)
      }
    }
  })

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
