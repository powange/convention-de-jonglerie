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
  editionId?: number
  delayMinutes?: number | null
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
  const { getUserAvatar } = useAvatar()

  const {
    teams,
    timeSlots,
    onTimeSlotCreate,
    onTimeSlotUpdate,
    onTimeSlotClick,
    onTimeSlotDelete: _onTimeSlotDelete,
  } = options

  // Computed pour les dates réactives
  const editionStartDate = computed(() => unref(options.editionStartDate))
  const editionEndDate = computed(() => unref(options.editionEndDate))
  const isReadOnly = computed(() => unref(options.readOnly) ?? false)
  const slotDurationMinutes = computed(() => unref(options.slotDuration) ?? 15)

  // En mode lecture seule, calculer les dates du premier et dernier créneau
  const startDate = computed(() => {
    if (!isReadOnly.value) {
      return editionStartDate.value
    }

    const slots = unref(timeSlots)
    if (slots.length === 0) {
      return editionStartDate.value
    }

    // Trouver le créneau avec la date de début la plus ancienne (en tenant compte du retard)
    const earliestSlot = slots.reduce((earliest, slot) => {
      const slotStart = new Date(slot.start)
      const earliestStart = new Date(earliest.start)

      // Appliquer le retard si présent
      if (slot.delayMinutes) {
        slotStart.setMinutes(slotStart.getMinutes() + slot.delayMinutes)
      }
      if (earliest.delayMinutes) {
        earliestStart.setMinutes(earliestStart.getMinutes() + earliest.delayMinutes)
      }

      return slotStart < earliestStart ? slot : earliest
    })

    return earliestSlot.start
  })

  const endDate = computed(() => {
    if (!isReadOnly.value) {
      return editionEndDate.value
    }

    const slots = unref(timeSlots)
    if (slots.length === 0) {
      return editionEndDate.value
    }

    // Trouver le créneau avec la date de fin la plus tardive (en tenant compte du retard)
    const latestSlot = slots.reduce((latest, slot) => {
      const slotEnd = new Date(slot.end)
      const latestEnd = new Date(latest.end)

      // Appliquer le retard si présent
      if (slot.delayMinutes) {
        slotEnd.setMinutes(slotEnd.getMinutes() + slot.delayMinutes)
      }
      if (latest.delayMinutes) {
        latestEnd.setMinutes(latestEnd.getMinutes() + latest.delayMinutes)
      }

      return slotEnd > latestEnd ? slot : latest
    })

    return latestSlot.end
  })

  const calendarRef = ref<any>(null)
  const ready = ref(false)
  const plugins = shallowRef<any[]>([])
  const allLocales = shallowRef<any[]>([])

  // Charger les plugins dynamiquement
  const loadPlugins = async () => {
    try {
      const [resourceTimeline, timeline, interaction, locales] = await Promise.all([
        import('@fullcalendar/resource-timeline'),
        import('@fullcalendar/timeline'),
        import('@fullcalendar/interaction'),
        import('@fullcalendar/core/locales-all'),
      ])

      plugins.value = [resourceTimeline.default, timeline.default, interaction.default]
      allLocales.value = locales.default
    } catch (error) {
      console.error('Error loading FullCalendar plugins:', error)
    }
  }

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
        title: t('edition.volunteers.unassigned_slots'),
        eventColor: '#6b7280', // gris
      },
      ...teamResources,
    ]
  })

  // Conversion des créneaux en événements FullCalendar
  const events = computed((): EventInput[] => {
    return unref(timeSlots).map((slot) => {
      const slotTitle = slot.title || t('edition.volunteers.untitled_slot')
      const counterInfo = `(${slot.assignedVolunteers}/${slot.maxVolunteers})`

      // Calculer les heures décalées si delayMinutes est présent
      let adjustedStart = slot.start
      let adjustedEnd = slot.end

      if (slot.delayMinutes && slot.delayMinutes > 0) {
        const startDate = new Date(slot.start)
        const endDate = new Date(slot.end)

        // Ajouter le retard en minutes
        startDate.setMinutes(startDate.getMinutes() + slot.delayMinutes)
        endDate.setMinutes(endDate.getMinutes() + slot.delayMinutes)

        adjustedStart = startDate.toISOString()
        adjustedEnd = endDate.toISOString()
      }

      return {
        id: slot.id,
        title: `${slotTitle} ${counterInfo}`, // Titre simple pour les cas où eventContent n'est pas utilisé
        start: adjustedStart,
        end: adjustedEnd,
        resourceId: slot.teamId || 'unassigned',
        color: slot.color,
        extendedProps: {
          description: slot.description,
          maxVolunteers: slot.maxVolunteers,
          assignedVolunteers: slot.assignedVolunteers,
          teamId: slot.teamId,
          assignedVolunteersList: slot.assignedVolunteersList,
          slotTitle, // Titre original pour eventContent
          delayMinutes: slot.delayMinutes, // Retard du créneau
          originalStart: slot.start, // Heure de début originale
          originalEnd: slot.end, // Heure de fin originale
        },
      }
    })
  })

  // Configuration du calendrier
  const calendarOptions = reactive<CalendarOptions>({
    plugins: plugins.value,
    locales: allLocales.value,
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
    resourceAreaHeaderContent: t('edition.volunteers.teams'),

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
      resourceTimelineDay: t('edition.volunteers.day_view'),
      resourceTimelineWeek: t('edition.volunteers.week_view'),
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
      const delayMinutes = event.extendedProps.delayMinutes

      // Créer le conteneur principal
      const container = document.createElement('div')
      container.className = 'volunteer-slot-content'

      // Titre du créneau avec compteur
      const titleDiv = document.createElement('div')
      titleDiv.className = 'slot-title'
      titleDiv.textContent = `${slotTitle} ${counterInfo}`
      container.appendChild(titleDiv)

      // Afficher le retard sur une ligne séparée si présent
      if (delayMinutes && delayMinutes > 0) {
        const delayDiv = document.createElement('div')
        delayDiv.className = 'slot-delay'
        delayDiv.style.fontSize = '0.7rem'
        delayDiv.style.color = '#f59e0b' // Orange pour le retard
        delayDiv.style.fontWeight = '500'
        delayDiv.style.marginTop = '2px'
        delayDiv.textContent = `⏱️ Retard: +${delayMinutes}min`
        container.appendChild(delayDiv)
      }

      // Section des avatars si il y a des bénévoles assignés
      if (assignedVolunteersList.length > 0) {
        const avatarsDiv = document.createElement('div')
        avatarsDiv.className = 'slot-avatars'

        // Limiter l'affichage à 4 bénévoles maximum
        const maxDisplay = 4
        const volunteersToDisplay = assignedVolunteersList.slice(0, maxDisplay)
        const remainingCount = assignedVolunteersList.length - maxDisplay

        volunteersToDisplay.forEach((assignment: any) => {
          const user = assignment.user
          const volunteerContainer = document.createElement('div')
          volunteerContainer.className = 'volunteer-item'

          // Créer l'avatar avec getUserAvatar (gère profilePicture, Gravatar et initiales)
          const avatar = document.createElement('img')
          avatar.setAttribute('src', getUserAvatar(user, 14))
          avatar.setAttribute('alt', user.pseudo || 'Avatar')
          avatar.className = 'user-avatar'
          avatar.style.width = '14px'
          avatar.style.height = '14px'
          avatar.style.borderRadius = '50%'
          avatar.style.objectFit = 'cover'
          avatar.style.border = '1px solid rgba(255, 255, 255, 0.8)'
          avatar.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)'
          avatar.style.flexShrink = '0'

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

        // Si il y a plus de bénévoles que le maximum affiché, ajouter une ligne "+X bénévoles"
        if (remainingCount > 0) {
          const moreContainer = document.createElement('div')
          moreContainer.className = 'volunteer-item volunteer-more'
          moreContainer.style.fontStyle = 'italic'
          moreContainer.style.fontSize = '0.65rem'

          const moreText = document.createElement('span')
          moreText.className = 'volunteer-text'
          moreText.textContent = `+${remainingCount} ${remainingCount === 1 ? 'bénévole' : 'bénévoles'}`

          moreContainer.appendChild(moreText)
          avatarsDiv.appendChild(moreContainer)
        }

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
      // En mode lecture seule, permettre le clic pour afficher les détails (onTimeSlotClick)
      // mais pas pour éditer (onTimeSlotUpdate)
      const callback = isReadOnly.value ? onTimeSlotClick : onTimeSlotClick || onTimeSlotUpdate

      if (callback) {
        const event = info.event
        // Utiliser le titre original depuis extendedProps
        const rawTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
        const slot: VolunteerTimeSlot = {
          id: event.id,
          title: rawTitle === t('edition.volunteers.untitled_slot') ? null : rawTitle,
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
        title: rawTitle === t('edition.volunteers.untitled_slot') ? null : rawTitle,
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
        title: rawTitle === t('edition.volunteers.untitled_slot') ? null : rawTitle,
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

  // Watcher pour mettre à jour les plugins et locales quand ils sont chargés
  watch([plugins, allLocales], ([newPlugins, newLocales]) => {
    calendarOptions.plugins = newPlugins
    calendarOptions.locales = newLocales
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

  // Watcher pour les dates d'édition et les créneaux (pour le mode lecture seule)
  watch(
    [startDate, endDate, timeSlots],
    ([newStartDate, newEndDate]) => {
      if (newStartDate && newEndDate) {
        calendarOptions.initialDate = newStartDate
        calendarOptions.validRange = {
          start: newStartDate,
          end: newEndDate,
        }
      }
    },
    { immediate: true }
  )

  // Watcher pour la granularité
  watch(
    slotDurationMinutes,
    (newDuration) => {
      const formattedDuration = `00:${String(newDuration).padStart(2, '0')}:00`

      // Mettre à jour l'option dans calendarOptions
      calendarOptions.slotDuration = formattedDuration

      // Mettre à jour aussi via l'API si le calendrier est déjà initialisé
      nextTick(() => {
        if (calendarRef.value && ready.value) {
          const calendarApi = calendarRef.value.getApi?.()
          if (calendarApi) {
            calendarApi.setOption('slotDuration', formattedDuration)
            // Forcer le re-render du calendrier
            calendarApi.refetchEvents()
          }
        }
      })
    },
    { immediate: false }
  )

  // Initialisation
  onMounted(async () => {
    await loadPlugins()
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
