import { dureeTraduisible, formatPlage } from '../utils/plage-horaire'

import type { CalendarOptions, EventInput } from '@fullcalendar/core'
// `ResourceInput` vit dans le paquet `resource`, pas dans `core` : l'importer de `core`
// ne résolvait rien, et le type des ressources était silencieusement perdu.
import type { ResourceInput } from '@fullcalendar/resource'
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
  /** Organisateurs affectés. Hors du compteur : ils ne prennent la place de personne. */
  assignedOrganizersList?: Array<{
    editionOrganizerId: number
    user: {
      id: number
      pseudo: string
      nom: string | null
      prenom: string | null
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

/**
 * Le nom affiché d'une personne : pseudo, nom complet, ou les deux.
 * Même règle pour un bénévole et pour un organisateur — c'est la même fiche utilisateur.
 */
function nomAffichePersonne(user: {
  id: number
  pseudo?: string | null
  prenom?: string | null
  nom?: string | null
}): string {
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim()
  if (user.pseudo && nomComplet) return `${user.pseudo} (${nomComplet})`
  return user.pseudo || nomComplet || `Utilisateur ${user.id}`
}

/** L'élément d'infobulle, unique et partagé : un par créneau en laisserait des centaines. */
let infobulleCreneau: HTMLElement | null = null

function obtenirInfobulle(): HTMLElement {
  if (infobulleCreneau?.isConnected) return infobulleCreneau

  const element = document.createElement('div')
  element.className = 'slot-tooltip'
  element.style.display = 'none'
  document.body.appendChild(element)
  infobulleCreneau = element
  return element
}

/** Près du curseur, mais jamais au-delà du bord de la fenêtre. */
function positionnerInfobulle(infobulle: HTMLElement, evenement: MouseEvent) {
  if (infobulle.style.display === 'none') return

  const marge = 12
  const rect = infobulle.getBoundingClientRect()
  const x = Math.min(evenement.clientX + marge, window.innerWidth - rect.width - marge)
  const y = Math.min(evenement.clientY + marge, window.innerHeight - rect.height - marge)

  infobulle.style.left = `${Math.max(marge, x)}px`
  infobulle.style.top = `${Math.max(marge, y)}px`
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
          assignedOrganizersList: slot.assignedOrganizersList,
          teamName: unref(teams).find((equipe) => equipe.id === slot.teamId)?.name ?? null,
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

    /**
     * Infobulle au survol d'un créneau : son nom, son équipe, et qui y est affecté.
     *
     * Le contenu du créneau lui-même est tronqué — quatre bénévoles au plus, trois
     * organisateurs, et des noms coupés par la largeur de la colonne. L'infobulle donne la
     * liste entière, seul endroit où on peut la lire sans ouvrir le créneau.
     *
     * Un seul élément réutilisé, posé à la racine de la page : à l'intérieur du calendrier, il
     * serait coupé par le défilement des colonnes.
     */
    eventDidMount: (arg) => {
      if (!import.meta.client) return

      const infobulle = obtenirInfobulle()
      const donnees = arg.event.extendedProps

      const afficher = (evenement: MouseEvent) => {
        infobulle.innerHTML = ''

        const titre = document.createElement('div')
        titre.className = 'slot-tooltip-title'
        titre.textContent = donnees.slotTitle || arg.event.title
        infobulle.appendChild(titre)

        // « 15h - 16h (1h) ». Les bornes de l'événement, donc décalées si le créneau a du
        // retard : c'est l'heure à laquelle on se présente, pas celle prévue à l'origine.
        const plage = formatPlage(arg.event.start, arg.event.end)
        if (plage) {
          const duree = dureeTraduisible(arg.event.start, arg.event.end)
          const horaire = document.createElement('div')
          horaire.className = 'slot-tooltip-horaire'
          horaire.textContent = duree ? `${plage} (${t(duree.cle, duree.valeurs)})` : plage
          infobulle.appendChild(horaire)
        }

        if (donnees.teamName) {
          const equipe = document.createElement('div')
          equipe.className = 'slot-tooltip-team'
          equipe.textContent = donnees.teamName
          infobulle.appendChild(equipe)
        }

        const benevoles = donnees.assignedVolunteersList || []
        const organisateurs = donnees.assignedOrganizersList || []

        const section = (libelle: string, personnes: any[], cle: string) => {
          if (personnes.length === 0) return
          const bloc = document.createElement('div')
          bloc.className = 'slot-tooltip-section'
          const entete = document.createElement('div')
          entete.className = 'slot-tooltip-label'
          entete.textContent = `${libelle} (${personnes.length})`
          bloc.appendChild(entete)
          for (const personne of personnes) {
            const ligne = document.createElement('div')
            ligne.className = 'slot-tooltip-person'
            ligne.textContent = nomAffichePersonne(personne[cle])
            bloc.appendChild(ligne)
          }
          infobulle.appendChild(bloc)
        }

        section(t('volunteers.assigned_volunteers'), benevoles, 'user')
        section(t('volunteers.assigned_organizers'), organisateurs, 'user')

        if (benevoles.length === 0 && organisateurs.length === 0) {
          const vide = document.createElement('div')
          vide.className = 'slot-tooltip-person'
          vide.textContent = t('volunteers.no_assigned_volunteers')
          infobulle.appendChild(vide)
        }

        infobulle.style.display = 'block'
        positionnerInfobulle(infobulle, evenement)
      }

      const masquer = () => {
        infobulle.style.display = 'none'
      }

      arg.el.addEventListener('mouseenter', afficher)
      arg.el.addEventListener('mousemove', (evenement) =>
        positionnerInfobulle(infobulle, evenement as MouseEvent)
      )
      arg.el.addEventListener('mouseleave', masquer)
      // Sans ça, l'infobulle reste suspendue au-dessus d'un créneau qui n'existe plus.
      ;(arg.el as any).__masquerInfobulle = masquer
    },

    eventWillUnmount: (arg) => {
      ;(arg.el as any).__masquerInfobulle?.()
    },

    // Rendu HTML personnalisé pour les événements
    eventContent: (arg) => {
      /** Une ligne « avatar + nom » telle qu'elle apparaît dans le créneau. */
      const lignePersonne = (user: any, organisateur = false): HTMLElement => {
        const ligne = document.createElement('div')
        ligne.className = organisateur ? 'volunteer-item organizer-item' : 'volunteer-item'

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

        const texte = document.createElement('span')
        texte.className = 'volunteer-text'
        texte.textContent = nomAffichePersonne(user)

        ligne.appendChild(avatar)
        ligne.appendChild(texte)
        return ligne
      }

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
          avatarsDiv.appendChild(lignePersonne(assignment.user))
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

      // Organisateurs affectés : mêmes lignes, mais après les bénévoles et distingués par leur
      // style — ils ne comptent pas dans le compteur du titre, et rien ne doit le laisser croire.
      const assignedOrganizersList = event.extendedProps.assignedOrganizersList || []
      if (assignedOrganizersList.length > 0) {
        const organisateursDiv = document.createElement('div')
        organisateursDiv.className = 'slot-avatars slot-organizers'

        const maxOrganisateurs = 3
        assignedOrganizersList
          .slice(0, maxOrganisateurs)
          .forEach((affectation: any) => organisateursDiv.appendChild(lignePersonne(affectation.user, true)))

        const restants = assignedOrganizersList.length - maxOrganisateurs
        if (restants > 0) {
          const plus = document.createElement('div')
          plus.className = 'volunteer-item organizer-item volunteer-more'
          plus.style.fontStyle = 'italic'
          plus.style.fontSize = '0.65rem'
          const texte = document.createElement('span')
          texte.className = 'volunteer-text'
          texte.textContent = `+${restants} ${restants === 1 ? 'organisateur' : 'organisateurs'}`
          plus.appendChild(texte)
          organisateursDiv.appendChild(plus)
        }

        container.appendChild(organisateursDiv)
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
          color: event.backgroundColor,
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
        // `backgroundColor` : `color` n'existe pas sur un événement FullCalendar rendu, la
        // couleur valait donc toujours `undefined` ici.
        color: event.backgroundColor,
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
        // `backgroundColor` : `color` n'existe pas sur un événement FullCalendar rendu, la
        // couleur valait donc toujours `undefined` ici.
        color: event.backgroundColor,
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

  /**
   * Recale le calendrier sur la période à couvrir, et seulement quand elle change.
   *
   * `timeSlots` figurait aussi dans la liste surveillée, pour le mode lecture seule où les
   * bornes se déduisent des créneaux. C'était superflu — `startDate` et `endDate` sont des
   * `computed` qui en dépendent déjà — et cela coûtait cher en gestion : ajouter ou supprimer
   * un créneau réécrivait `initialDate`, ce qui ramenait la frise à son premier jour. On
   * remplissait un planning en refaisant défiler la timeline après chaque créneau.
   *
   * La comparaison sur les valeurs précédentes est nécessaire : `startDate` renvoie une chaîne
   * recalculée à chaque évaluation, si bien qu'un simple déclenchement du watcher ne dit pas
   * que la période a bougé.
   */
  watch(
    [startDate, endDate],
    ([newStartDate, newEndDate], [ancienStart, ancienEnd] = []) => {
      if (!newStartDate || !newEndDate) return
      if (newStartDate === ancienStart && newEndDate === ancienEnd) return

      calendarOptions.initialDate = newStartDate
      calendarOptions.validRange = {
        start: newStartDate,
        end: newEndDate,
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
