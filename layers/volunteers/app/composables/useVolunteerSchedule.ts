import { dureeTraduisible, formatPlage } from '../utils/plage-horaire'
import { positionInitialeDuPlanning } from '../utils/position-initiale-planning'
import { creneauAPourvoir, placesOccupees } from '../utils/remplissage-creneau'
import { horairesEffectifs } from '../utils/retard-creneau'

import type { CalendarOptions, EventInput } from '@fullcalendar/core'
// `ResourceInput` vit dans le paquet `resource`, pas dans `core` : l'importer de `core`
// ne résolvait rien, et le type des ressources était silencieusement perdu.
import type { ResourceInput } from '@fullcalendar/resource'
import type { ComputedRef, Ref } from 'vue'

import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

// Type simplifié pour FullCalendar (compatible avec VolunteerTeam)
export interface VolunteerTeamCalendar {
  id: string
  name: string
  color: string
  /** Volante : ses créneaux ne pèsent pas dans les heures à pourvoir. Marquée d'une pastille. */
  isFloatingTeam?: boolean
  /** Autonome : elle s'organise elle-même, et réserve ses membres. Marquée de même. */
  isAutonomousTeam?: boolean
}

export interface VolunteerTimeSlot {
  id: string
  title: string | null
  /**
   * `startDateTime` / `endDateTime`, et non `start` / `end`.
   *
   * Un créneau portait deux jeux de noms selon le point d'API qui le rendait — celui du schéma
   * Prisma d'un côté, celui de FullCalendar de l'autre. Chaque rencontre entre les deux mondes
   * exigeait un adaptateur, et un consommateur branché sur la mauvaise moitié lisait `undefined`
   * sans que rien ne le signale.
   *
   * Un seul nom désormais, de la base à l'écran : celui de la base. `start` / `end` ne survivent
   * que dans les ÉVÉNEMENTS remis à FullCalendar, qui les impose.
   */
  startDateTime: string
  endDateTime: string
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
  /** Organisateurs affectés. Ils occupent une place, et entrent donc dans le compteur. */
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
  /**
   * Fuseau de l'édition (IANA). Un horaire de convention est une heure de LIEU : un créneau à 14 h
   * est à 14 h sur place, que le planning soit consulté depuis Paris ou depuis Tokyo. Sans lui,
   * le calendrier retombe sur le fuseau du navigateur — et le même créneau change d'heure selon
   * qui regarde.
   */
  fuseau?: string | null | Ref<string | null | undefined> | ComputedRef<string | null | undefined>
  /** Vue d'ouverture du calendrier — jour ou semaine. Reprise de l'URL. */
  vueInitiale?: string
  /** Date d'ouverture, `AAAA-MM-JJ`. Absente, le calendrier s'ouvre au premier jour de l'édition. */
  dateInitiale?: string | null
  /** Appelé quand l'utilisateur change de vue ou navigue : sert à tenir l'URL à jour. */
  onVueChange?: (vue: string, date: string) => void
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

/**
 * Le jour d'une date, en heure LOCALE, au format `AAAA-MM-JJ`.
 *
 * `toISOString()` donnerait la date UTC : sur un calendrier ouvert au 25 à 00h30 en France, l'URL
 * porterait le 24, et le rechargement n'afficherait pas la même chose. Le même piège que pour le
 * découpage des statistiques par jour.
 */
function jourLocal(date: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
}

export function useVolunteerSchedule(options: UseVolunteerScheduleOptions) {
  const { t, locale } = useI18n()
  const { getUserAvatar, generateInitialsAvatar } = useAvatar()

  /**
   * Le triangle d'alerte des créneaux qu'il reste à pourvoir.
   *
   * Un emoji et non une icône Nuxt UI : FullCalendar construit ces nœuds en DOM natif, où aucun
   * composant Vue ne peut être monté. Le fichier s'en sert déjà pour la mention de retard.
   *
   * Le libellé passe par `title` ET `aria-label` : une couleur seule ne dit rien à qui ne la
   * distingue pas, et l'infobulle du navigateur ne s'ouvre pas sans souris.
   */
  const iconeAPourvoir = (): HTMLElement => {
    const alerte = document.createElement('span')
    alerte.className = 'slot-alerte'
    alerte.textContent = '⚠️'
    alerte.setAttribute('title', t('volunteers.slot_understaffed'))
    alerte.setAttribute('aria-label', t('volunteers.slot_understaffed'))
    return alerte
  }

  /**
   * L'image d'une personne, prête à être posée devant son nom.
   *
   * Sans photo de profil, `getUserAvatar` rend une adresse Gravatar en `d=404` : le service
   * répond 404 pour qui n'y a pas de compte, et l'image reste cassée. Le repli sur les initiales
   * vit dans `getUserAvatarWithCache`, qu'un rendu en DOM natif ne peut pas utiliser — d'où ce
   * `onerror`, calqué sur le planning du matériel.
   *
   * Écrit une fois pour les deux usages : le contenu du créneau et l'infobulle de survol.
   */
  const avatarDe = (personne: any, taille: number, classe: string): HTMLImageElement => {
    const nom = nomAffichePersonne(personne)
    const image = document.createElement('img')
    image.src = getUserAvatar(personne, taille)
    image.alt = ''
    image.className = classe
    image.onerror = () => {
      image.onerror = null
      image.src = generateInitialsAvatar(nom || '?', taille)
    }
    return image
  }

  const {
    teams,
    timeSlots,
    onTimeSlotCreate,
    onTimeSlotUpdate,
    onTimeSlotClick,
    onTimeSlotDelete: _onTimeSlotDelete,
    vueInitiale,
    dateInitiale,
    onVueChange,
  } = options

  // Computed pour les dates réactives
  const editionStartDate = computed(() => unref(options.editionStartDate))
  const editionEndDate = computed(() => unref(options.editionEndDate))
  const isReadOnly = computed(() => unref(options.readOnly) ?? false)

  /**
   * Le fuseau réellement utilisable, ou `undefined` pour celui de la machine.
   *
   * La décision de ce qui est « utilisable » n'est pas reprise ici : elle vit dans
   * `fuseau-edition`, qui écarte aussi bien le fuseau absent que celui devenu invalide après un
   * import. La recopier ferait diverger le calendrier du reste de l'application le jour où cette
   * règle changerait.
   */
  const fuseauDuCalendrier = computed(() => fuseauUtilisable(unref(options.fuseau)))
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
      const slotStart = new Date(slot.startDateTime)
      const earliestStart = new Date(earliest.startDateTime)

      // Appliquer le retard si présent
      if (slot.delayMinutes) {
        slotStart.setMinutes(slotStart.getMinutes() + slot.delayMinutes)
      }
      if (earliest.delayMinutes) {
        earliestStart.setMinutes(earliestStart.getMinutes() + earliest.delayMinutes)
      }

      return slotStart < earliestStart ? slot : earliest
    })

    return earliestSlot.startDateTime
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
      const slotEnd = new Date(slot.endDateTime)
      const latestEnd = new Date(latest.endDateTime)

      // Appliquer le retard si présent
      if (slot.delayMinutes) {
        slotEnd.setMinutes(slotEnd.getMinutes() + slot.delayMinutes)
      }
      if (latest.delayMinutes) {
        latestEnd.setMinutes(latestEnd.getMinutes() + latest.delayMinutes)
      }

      return slotEnd > latestEnd ? slot : latest
    })

    return latestSlot.endDateTime
  })

  const calendarRef = ref<any>(null)
  const ready = ref(false)
  const plugins = shallowRef<any[]>([])
  const allLocales = shallowRef<any[]>([])

  // Charger les plugins dynamiquement
  const loadPlugins = async () => {
    try {
      // `luxon3` est ce qui autorise un fuseau NOMMÉ (« Europe/Paris ») : sans ce greffon,
      // FullCalendar n'accepte que `local` et `UTC`, et ignore silencieusement le reste.
      const [resourceTimeline, timeline, interaction, luxon3, locales] = await Promise.all([
        import('@fullcalendar/resource-timeline'),
        import('@fullcalendar/timeline'),
        import('@fullcalendar/interaction'),
        import('@fullcalendar/luxon3'),
        import('@fullcalendar/core/locales-all'),
      ])

      plugins.value = [
        resourceTimeline.default,
        timeline.default,
        interaction.default,
        luxon3.default,
      ]
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
      // Lus par `resourceLabelContent` : la nature d'une équipe change la lecture de toute sa
      // ligne — ses créneaux ne pèsent pas dans les heures à pourvoir.
      extendedProps: {
        isFloatingTeam: team.isFloatingTeam === true,
        isAutonomousTeam: team.isAutonomousTeam === true,
      },
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
      // Les places se comptent toutes ensemble : un organisateur en occupe une, le compteur
      // doit donc l'inclure, sans quoi un créneau plein paraîtrait encore libre.
      const counterInfo = `(${placesOccupees(slot)}/${slot.maxVolunteers})`

      // Les créneaux des équipes volantes et autonomes ne sont pas « à pourvoir » : personne
      // d'autre ne viendra les couvrir. Les signaler ferait paraître l'édition sous-dotée, comme
      // les compter le ferait dans les statistiques.
      const equipe = unref(teams).find((candidate) => candidate.id === slot.teamId)
      const horsCharge = equipe?.isFloatingTeam === true || equipe?.isAutonomousTeam === true

      // Les heures réelles du créneau, décalage compris. La règle vit dans `retard-creneau`,
      // partagée avec les cinq autres surfaces qui annoncent un créneau.
      const horaires = horairesEffectifs(slot.startDateTime, slot.endDateTime, slot.delayMinutes)
      const adjustedStart = horaires ? horaires.debut.toISOString() : slot.startDateTime
      const adjustedEnd = horaires ? horaires.fin.toISOString() : slot.endDateTime

      return {
        id: slot.id,
        title: `${slotTitle} ${counterInfo}`, // Titre simple pour les cas où eventContent n'est pas utilisé
        start: adjustedStart,
        end: adjustedEnd,
        resourceId: slot.teamId || 'unassigned',
        color: slot.color,
        extendedProps: {
          // Calculé ici plutôt qu'à l'affichage : l'équipe du créneau, dont dépend la règle,
          // n'est pas accessible depuis le rendu d'un événement.
          aPourvoir: creneauAPourvoir(slot, horsCharge),
          description: slot.description,
          maxVolunteers: slot.maxVolunteers,
          assignedVolunteers: slot.assignedVolunteers,
          teamId: slot.teamId,
          assignedVolunteersList: slot.assignedVolunteersList,
          assignedOrganizersList: slot.assignedOrganizersList,
          teamName: unref(teams).find((equipe) => equipe.id === slot.teamId)?.name ?? null,
          slotTitle, // Titre original pour eventContent
          delayMinutes: slot.delayMinutes, // Retard du créneau
          originalStart: slot.startDateTime, // Heure de début originale
          originalEnd: slot.endDateTime, // Heure de fin originale
        },
      }
    })
  })

  // Configuration du calendrier
  const calendarOptions = reactive<CalendarOptions>({
    plugins: plugins.value,
    locales: allLocales.value,
    locale: locale.value,

    // Les heures s'affichent dans le fuseau de l'ÉDITION, pas dans celui du lecteur.
    // `'local'` en repli : une édition peut ne pas déclarer de fuseau, et un planning aux heures
    // du navigateur reste plus utile qu'un planning vide.
    timeZone: fuseauDuCalendrier.value ?? 'local',

    // Vue timeline par ressource. Reprise de l'URL quand elle en porte une : un rechargement,
    // ou un lien envoyé à quelqu'un, doit rouvrir la vue qu'on regardait.
    initialView: vueInitiale ?? 'resourceTimelineWeek',

    // Date initiale : celle de l'URL, sinon le premier jour de l'événement.
    initialDate: dateInitiale || startDate.value,

    // Période visible (limite la navigation)
    validRange: {
      start: startDate.value,
      end: endDate.value,
    },

    /*
     * La barre verticale rouge de l'instant présent.
     *
     * Une seule ligne suffit pour les DEUX plannings — celui de la gestion et la page publique d'un
     * bénévole — parce que les deux pages emploient la même carte, laquelle passe par ce composable.
     * L'écrire dans chaque page aurait ouvert la porte à ce qu'elles divergent.
     *
     * FullCalendar la place d'après l'horloge réelle, mais dans le FUSEAU DU CALENDRIER, réglé
     * au-dessus sur celui de l'édition. C'est le bon repère : un planning se lit à l'heure du lieu
     * où l'on est bénévole, pas à celle du navigateur.
     *
     * Elle n'apparaît que si l'instant présent tombe dans la période affichée. Sur une édition à
     * venir, il n'y a donc rien à voir — et c'est juste : une barre posée au bord de l'écran
     * mentirait sur ce qu'elle désigne.
     */
    nowIndicator: true,

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

    /**
     * Le nom d'une équipe, suivi d'une icône quand elle n'est pas ordinaire.
     *
     * Une équipe volante ou autonome ne pèse pas dans les heures à pourvoir : sans repère, on lit
     * sa ligne comme celle des autres et l'on s'étonne que ses créneaux ne comptent nulle part.
     *
     * ⚠️ Une ICÔNE et non le mot entier : cette colonne est étroite, et « Surveillance gymnase »
     * suivi de « Volants » se tronquerait. Le sens passe par l'attribut `title`, donc par
     * l'infobulle du navigateur — FullCalendar construit cette colonne en DOM natif, où les
     * composants Nuxt UI ne peuvent pas être montés. Elle est plus lente et moins jolie qu'un
     * `UTooltip`, mais elle fonctionne partout, y compris à l'appui long sur mobile, et ne
     * demande aucun positionnement à entretenir dans une colonne qui défile.
     */
    resourceLabelContent: (arg) => {
      const conteneur = document.createElement('div')
      conteneur.className = 'flex items-center gap-1.5'

      const nom = document.createElement('span')
      nom.textContent = arg.resource.title
      nom.style.minWidth = '0'
      nom.style.overflow = 'hidden'
      nom.style.textOverflow = 'ellipsis'
      conteneur.appendChild(nom)

      const proprietes = arg.resource.extendedProps as {
        isFloatingTeam?: boolean
        isAutonomousTeam?: boolean
      }

      /** Une pastille d'une seule lettre, dont le titre dit ce qu'elle signifie. */
      const repere = (symbole: string, libelle: string, fond: string, encre: string) => {
        const marque = document.createElement('span')
        marque.textContent = symbole
        // Le libellé complet reste accessible : au survol, et aux lecteurs d'écran.
        marque.setAttribute('title', libelle)
        marque.setAttribute('aria-label', libelle)
        marque.style.display = 'inline-flex'
        marque.style.alignItems = 'center'
        marque.style.justifyContent = 'center'
        marque.style.width = '18px'
        marque.style.height = '18px'
        marque.style.flexShrink = '0'
        marque.style.fontSize = '0.7rem'
        marque.style.lineHeight = '1'
        marque.style.borderRadius = '9999px'
        marque.style.backgroundColor = fond
        marque.style.color = encre
        marque.style.cursor = 'help'
        conteneur.appendChild(marque)
      }

      if (proprietes?.isFloatingTeam) {
        repere('⚡', t('volunteers.floating_team_badge'), 'rgba(56, 189, 248, 0.22)', '#0369a1')
      }
      if (proprietes?.isAutonomousTeam) {
        repere('🔒', t('volunteers.autonomous_team_badge'), 'rgba(120, 120, 120, 0.22)', '#4b5563')
      }

      return { domNodes: [conteneur] }
    },

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
        if (donnees.aPourvoir) titre.appendChild(iconeAPourvoir())
        const texteTitre = document.createElement('span')
        texteTitre.textContent = donnees.slotTitle || arg.event.title
        titre.appendChild(texteTitre)
        infobulle.appendChild(titre)

        // « 15h - 16h (1h) ». Les bornes de l'événement, donc décalées si le créneau a du
        // retard : c'est l'heure à laquelle on se présente, pas celle prévue à l'origine.
        // L'infobulle doit annoncer la même heure que la case qu'elle survole : sans le fuseau,
        // FullCalendar affichait l'heure du lieu et l'infobulle celle du navigateur.
        const plage = formatPlage(arg.event.start, arg.event.end, fuseauDuCalendrier.value)
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

        const section = (libelle: string, personnes: any[], cle: string, maximum?: number) => {
          if (personnes.length === 0) return
          const bloc = document.createElement('div')
          bloc.className = 'slot-tooltip-section'
          const entete = document.createElement('div')
          entete.className = 'slot-tooltip-label'
          // « 2/3 » plutôt que « 2 » : le nombre seul ne dit pas s'il en manque. Réservé aux
          // bénévoles — le maximum est celui du créneau, pas celui des organisateurs.
          const compte = maximum ? `${personnes.length}/${maximum}` : `${personnes.length}`
          entete.textContent = `${libelle} (${compte})`
          bloc.appendChild(entete)
          for (const personne of personnes) {
            const ligne = document.createElement('div')
            ligne.className = 'slot-tooltip-person'
            ligne.appendChild(avatarDe(personne[cle], 16, 'slot-tooltip-avatar'))
            const nom = document.createElement('span')
            nom.textContent = nomAffichePersonne(personne[cle])
            ligne.appendChild(nom)
            bloc.appendChild(ligne)
          }
          infobulle.appendChild(bloc)
        }

        section(t('volunteers.assigned_volunteers'), benevoles, 'user', donnees.maxVolunteers)
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

        const nomAffiche = nomAffichePersonne(user)

        const avatar = avatarDe(user, 14, 'user-avatar')
        avatar.style.width = '14px'
        avatar.style.height = '14px'
        avatar.style.borderRadius = '50%'
        avatar.style.objectFit = 'cover'
        avatar.style.border = '1px solid rgba(255, 255, 255, 0.8)'
        avatar.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)'
        avatar.style.flexShrink = '0'

        const texte = document.createElement('span')
        texte.className = 'volunteer-text'
        texte.textContent = nomAffiche

        ligne.appendChild(avatar)
        ligne.appendChild(texte)
        return ligne
      }

      const event = arg.event
      const slotTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
      const counterInfo = `(${placesOccupees(event.extendedProps as any)}/${event.extendedProps.maxVolunteers})`
      const assignedVolunteersList = event.extendedProps.assignedVolunteersList || []
      const delayMinutes = event.extendedProps.delayMinutes

      // Créer le conteneur principal
      const container = document.createElement('div')
      container.className = 'volunteer-slot-content'

      // Titre du créneau avec compteur
      const titleDiv = document.createElement('div')
      titleDiv.className = 'slot-title'
      if (event.extendedProps.aPourvoir) titleDiv.appendChild(iconeAPourvoir())
      const texteTitre = document.createElement('span')
      texteTitre.textContent = `${slotTitle} ${counterInfo}`
      titleDiv.appendChild(texteTitre)
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
      // style. Leurs places entrent bien dans le compteur du titre.
      const assignedOrganizersList = event.extendedProps.assignedOrganizersList || []
      if (assignedOrganizersList.length > 0) {
        const organisateursDiv = document.createElement('div')
        organisateursDiv.className = 'slot-avatars slot-organizers'

        const maxOrganisateurs = 3
        assignedOrganizersList
          .slice(0, maxOrganisateurs)
          .forEach((affectation: any) =>
            organisateursDiv.appendChild(lignePersonne(affectation.user, true))
          )

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
          startDateTime: event.startStr,
          endDateTime: event.endStr,
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

    /**
     * Vue ou date changée : FullCalendar appelle ce rappel dans les deux cas, y compris sur les
     * flèches de navigation. C'est donc le seul point d'où l'URL peut suivre ce qu'on regarde.
     *
     * `activeStart` et non `currentStart` : sur la vue semaine, c'est la date réellement affichée
     * à gauche, celle qu'il faut redonner au calendrier pour retrouver la même image.
     */
    datesSet: (info) => {
      if (!onVueChange) return
      const jour = info.view.currentStart ?? info.start
      onVueChange(info.view.type, jourLocal(jour))
    },

    // Drag & drop des événements
    eventDrop: (info) => {
      const event = info.event
      // Utiliser le titre original depuis extendedProps
      const rawTitle = event.extendedProps.slotTitle || event.title.split(' (')[0]
      const updatedSlot: VolunteerTimeSlot = {
        id: event.id,
        title: rawTitle === t('edition.volunteers.untitled_slot') ? null : rawTitle,
        startDateTime: event.startStr,
        endDateTime: event.endStr,
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
        startDateTime: event.startStr,
        endDateTime: event.endStr,
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

  // L'édition se charge en asynchrone : le calendrier est souvent construit AVANT que son fuseau
  // soit connu. Sans ce watcher, il resterait figé sur l'heure du navigateur, et seul un
  // rechargement complet afficherait les bonnes heures.
  watch(fuseauDuCalendrier, (nouveau) => {
    calendarOptions.timeZone = nouveau ?? 'local'
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
  /**
   * Pose la frise sur le premier créneau, une seule fois.
   *
   * Les créneaux arrivent après le premier rendu : la position ne peut donc pas être calculée
   * à la construction des options. Elle est appliquée au premier chargement qui en rapporte au
   * moins un, puis plus jamais — la replacer à chaque ajout ramènerait le défaut que les tests
   * de position verrouillent déjà, où remplir un planning obligeait à refaire défiler la frise
   * après chaque geste.
   */
  const positionPosee = ref(false)

  watch(
    [startDate, () => unref(timeSlots)],
    ([debut, creneaux]) => {
      if (positionPosee.value || !creneaux || creneaux.length === 0) return

      const position = positionInitialeDuPlanning(debut, creneaux)
      positionPosee.value = true
      if (!position) return

      calendarOptions.scrollTime = position
      // Les options sont lues au rendu ; le calendrier déjà monté ne les relit pas de lui-même.
      calendarRef.value?.getApi?.()?.scrollToTime?.(position)
    },
    { immediate: true }
  )

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
