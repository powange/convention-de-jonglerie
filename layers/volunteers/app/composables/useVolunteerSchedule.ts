import { dureeTraduisible, formatPlage } from '../utils/plage-horaire'
import { positionInitialeDuPlanning } from '../utils/position-initiale-planning'
import { creneauAPourvoir, placesOccupees } from '../utils/remplissage-creneau'
import { horairesEffectifs } from '../utils/retard-creneau'

import type { ComputedRef, Ref } from 'vue'

import { fuseauUtilisable, versChampLocal, versInstant } from '#core/shared/utils/fuseau-edition'
import {
  decalageDuFuseau,
  heureMurale,
  type OptionsCalendrier,
} from '#ui-commun/app/utils/calendrier-flottant'

// Type simplifié pour le calendrier (compatible avec VolunteerTeam)
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
   * Prisma d'un côté, celui du calendrier de l'autre. Chaque rencontre entre les deux mondes
   * exigeait un adaptateur, et un consommateur branché sur la mauvaise moitié lisait `undefined`
   * sans que rien ne le signale.
   *
   * Un seul nom désormais, de la base à l'écran : celui de la base. `start` / `end` ne survivent
   * que dans les ÉVÉNEMENTS remis au calendrier, qui les impose.
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

/**
 * Masque l'infobulle.
 *
 * FullCalendar prévenait du retrait d'un créneau (`eventWillUnmount`), et l'infobulle s'effaçait
 * avec lui. EventCalendar n'a pas ce rappel : on l'efface donc chaque fois que les créneaux sont
 * renvoyés au calendrier, et au démontage — sans quoi elle resterait suspendue au-dessus d'un
 * créneau qui n'existe plus.
 */
export function masquerInfobulleCreneau() {
  if (infobulleCreneau) infobulleCreneau.style.display = 'none'
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
  const { getUserAvatar, generateInitialsAvatar } = useAvatar()

  /**
   * Le triangle d'alerte des créneaux qu'il reste à pourvoir.
   *
   * Un emoji et non une icône Nuxt UI : le calendrier construit ces nœuds en DOM natif, où aucun
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

  /**
   * Une date-heure du lieu, telle que le calendrier l'affiche. `versChampLocal` rend
   * `AAAA-MM-JJTHH:MM` dans le fuseau de l'édition (changements d'heure compris) — ou dans celui de
   * la machine quand l'édition n'en déclare pas, comme le faisait `timeZone: 'local'`.
   */
  const versCalendrier = (instant: string) => versChampLocal(instant, fuseauDuCalendrier.value)

  /** L'instant d'une heure murale rendue par le calendrier (sélection, glisser, étirer). */
  const versInstantDuLieu = (date: Date) => {
    const instant = versInstant(heureMurale(date), fuseauDuCalendrier.value)
    return instant || date.toISOString()
  }

  // Configuration des ressources (équipes + "Non assigné")
  const resources = computed(() => {
    const teamResources = unref(teams).map((team) => ({
      id: team.id,
      title: team.name,
      eventBackgroundColor: team.color || '#3788d8',
      // Lus par `resourceLabelContent` : la nature d'une équipe change la lecture de toute sa
      // ligne — ses créneaux ne pèsent pas dans les heures à pourvoir.
      extendedProps: {
        isFloatingTeam: team.isFloatingTeam === true,
        isAutonomousTeam: team.isAutonomousTeam === true,
      },
    }))

    // Ajouter une ressource "Non assigné" pour les créneaux sans équipe, EN DERNIER : c'est là que
    // FullCalendar la rangeait (tri par identifiant, `unassigned` après ceux des équipes), et
    // EventCalendar garde l'ordre reçu.
    return [
      ...teamResources,
      {
        id: 'unassigned',
        title: t('edition.volunteers.unassigned_slots'),
        eventBackgroundColor: '#6b7280', // gris
        extendedProps: {},
      },
    ]
  })

  // Conversion des créneaux en événements du calendrier
  const events = computed(() => {
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
        // Heures du LIEU, sans décalage : le calendrier les affiche telles quelles (cf.
        // `calendrier-flottant`).
        start: versCalendrier(adjustedStart),
        end: versCalendrier(adjustedEnd),
        resourceIds: [slot.teamId || 'unassigned'],
        // Sans couleur propre, le créneau prend celle de son équipe (`eventBackgroundColor` de la
        // ressource) : une couleur `undefined` explicite l'effacerait.
        ...(slot.color ? { backgroundColor: slot.color } : {}),
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
          // Les instants affichés, retard compris, pour l'infobulle : les `Date` du calendrier
          // portent l'heure murale, pas l'instant.
          debutAffiche: adjustedStart,
          finAffichee: adjustedEnd,
          color: slot.color,
        },
      }
    })
  })

  /** Le créneau tel que les rappels le remettent à la page, depuis un événement du calendrier. */
  const creneauDepuisEvenement = (event: any, resourceId?: string): VolunteerTimeSlot => {
    const rawTitle = event.extendedProps.slotTitle || String(event.title).split(' (')[0]
    const equipe = resourceId ?? event.resourceIds?.[0]
    return {
      id: event.id,
      title: rawTitle === t('edition.volunteers.untitled_slot') ? null : rawTitle,
      // L'heure affichée, ramenée à un instant dans le fuseau du lieu.
      startDateTime: versInstantDuLieu(event.start),
      endDateTime: versInstantDuLieu(event.end),
      teamId: equipe === 'unassigned' ? undefined : equipe,
      maxVolunteers: event.extendedProps.maxVolunteers,
      assignedVolunteers: event.extendedProps.assignedVolunteers,
      color: event.extendedProps.color,
      description: event.extendedProps.description,
      assignedVolunteersList: event.extendedProps.assignedVolunteersList,
    }
  }

  /**
   * Le nom d'une équipe, suivi d'une icône quand elle n'est pas ordinaire.
   *
   * Une équipe volante ou autonome ne pèse pas dans les heures à pourvoir : sans repère, on lit
   * sa ligne comme celle des autres et l'on s'étonne que ses créneaux ne comptent nulle part.
   *
   * ⚠️ Une ICÔNE et non le mot entier : cette colonne est étroite, et « Surveillance gymnase »
   * suivi de « Volants » se tronquerait. Le sens passe par l'attribut `title`, donc par
   * l'infobulle du navigateur — le calendrier construit cette colonne en DOM natif, où les
   * composants Nuxt UI ne peuvent pas être montés. Elle est plus lente et moins jolie qu'un
   * `UTooltip`, mais elle fonctionne partout, y compris à l'appui long sur mobile, et ne
   * demande aucun positionnement à entretenir dans une colonne qui défile.
   */
  const resourceLabelContent = (arg: any) => {
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
  }

  // Configuration du calendrier
  const calendarOptions = reactive<OptionsCalendrier>({
    // Formats de dates (titre, en-têtes, heures) dans la langue de l'interface : EventCalendar
    // passe par `Intl`, aucun paquet de traductions à charger.
    locale: locale.value,

    // L'INSTANT PRÉSENT dans le fuseau de l'édition (barre de l'heure actuelle, « Aujourd'hui »).
    // Les créneaux, eux, arrivent en heures du lieu : cf. `calendrier-flottant`.
    timeZone: decalageDuFuseau(fuseauDuCalendrier.value),

    // Vue timeline par ressource. Reprise de l'URL quand elle en porte une : un rechargement,
    // ou un lien envoyé à quelqu'un, doit rouvrir la vue qu'on regardait. Mêmes noms de vue
    // qu'avec FullCalendar : les liens déjà partagés restent valides.
    view: vueInitiale ?? 'resourceTimelineWeek',

    // Date initiale : celle de l'URL, sinon le premier jour de l'événement.
    date: dateInitiale || String(startDate.value).slice(0, 10),

    // Période visible (limite la navigation)
    validRange: {
      start: String(startDate.value).slice(0, 10),
      end: String(endDate.value).slice(0, 10),
    },

    /*
     * La barre verticale rouge de l'instant présent.
     *
     * Une seule ligne suffit pour les DEUX plannings — celui de la gestion et la page publique d'un
     * bénévole — parce que les deux pages emploient la même carte, laquelle passe par ce composable.
     * L'écrire dans chaque page aurait ouvert la porte à ce qu'elles divergent.
     *
     * Le calendrier la place d'après l'horloge réelle, dans son `timeZone` — réglé sur le décalage
     * actuel de l'édition. C'est le bon repère : un planning se lit à l'heure du lieu où l'on est
     * bénévole, pas à celle du navigateur.
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
    // Largeur d'une case de granularité : à 15 minutes, 32 px (défaut) donnaient une heure de
    // 128 px, bien plus large qu'avec FullCalendar. Celle-ci garde une heure d'environ 60 px.
    slotWidth: slotWidthPour(slotDurationMinutes.value),

    // Configuration des ressources
    resources: [],

    // Configuration des événements
    events: [],
    editable: !isReadOnly.value,
    selectable: !isReadOnly.value,
    // Les chevauchements sont permis par défaut (créneaux simultanés d'une même équipe) : il n'y
    // a plus d'option `eventOverlap` / `selectOverlap` à poser.

    // La colonne des équipes porte un titre, comme sous FullCalendar (`resourceAreaHeaderContent`,
    // sans équivalent ici) : il est posé par le composant, cf. `PlanningCard`.

    resourceLabelContent,

    // Hauteur du calendrier
    height: 'auto',

    // Configuration de l'affichage
    headerToolbar: {
      start: 'prev,next today',
      center: 'title',
      end: 'resourceTimelineDay,resourceTimelineWeek',
    },

    // Format du titre principal pour afficher le nom du jour
    titleFormat: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },

    // Textes des boutons
    buttonText: (textes: Record<string, string>) => ({
      ...textes,
      today: t('calendar.today'),
      resourceTimelineDay: t('edition.volunteers.day_view'),
      resourceTimelineWeek: t('edition.volunteers.week_view'),
    }),

    // Configuration spécifique des vues
    views: {
      resourceTimelineDay: {
        slotLabelFormat: {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        },
        dayHeaderFormat: {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        },
      },
      resourceTimelineWeek: {
        /*
         * SEPT JOURS À PARTIR DE LA DATE affichée, et non la semaine du calendrier : EventCalendar
         * montrait du dimanche au samedi, jours hors de l'édition compris (grisés), et l'on
         * ouvrait le planning sur un dimanche vide. Partir du premier jour de l'édition montre
         * d'emblée ses journées, comme le faisait FullCalendar en rognant la semaine à la période
         * autorisée.
         */
        // Rognée à la durée de l'édition quand elle est plus courte (cf. `joursDeLaVueSemaine`) :
        // FullCalendar ne montrait que les jours autorisés de la semaine.
        duration: { days: joursDeLaVueSemaine(startDate.value, endDate.value) },
        // « 06 h », comme l'affichait FullCalendar en français sur la vue semaine.
        slotLabelFormat: { hour: '2-digit' },
        // « sam. 10/07 », comme sous FullCalendar.
        dayHeaderFormat: {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
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
    eventDidMount: (arg: any) => {
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

        // « 15h - 16h (1h) ». Les bornes affichées, donc décalées si le créneau a du retard :
        // c'est l'heure à laquelle on se présente, pas celle prévue à l'origine. L'infobulle doit
        // annoncer la même heure que la case qu'elle survole, d'où le fuseau de l'édition.
        const debut = new Date(donnees.debutAffiche)
        const fin = new Date(donnees.finAffichee)
        const plage = formatPlage(debut, fin, fuseauDuCalendrier.value)
        if (plage) {
          const duree = dureeTraduisible(debut, fin)
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

      /*
       * Des événements de POINTEUR, et le type de pointeur en garde.
       *
       * Au doigt, le navigateur émet les événements de souris EN PLUS du clic : `mouseenter` puis
       * `click`. L'infobulle s'ouvrait donc, la modale du créneau s'ouvrait par-dessus — et comme le
       * doigt ne « sort » de rien, `mouseleave` ne se déclenchait jamais : l'infobulle restait
       * suspendue au-dessus de la modale.
       *
       * ⚠️ Le TYPE DE POINTEUR, et non une détection d'appareil. Les trois autres façons de faire
       * échouent chacune sur un cas réel :
       *
       * - la largeur de l'écran confondrait une tablette large avec un ordinateur ;
       * - l'agent utilisateur se trompe souvent et vieillit mal ;
       * - `(hover: hover)` laisserait passer le défaut sur un portable à écran tactile — son entrée
       *   PRINCIPALE sait survoler, la règle répondrait « affiche », et le doigt reprendrait le même
       *   chemin.
       *
       * Le type de pointeur se juge geste par geste : sur le même appareil, la souris garde
       * l'infobulle et le doigt ne l'a plus.
       *
       * Rien ne se perd au tactile : l'appui ouvre la modale du créneau, qui porte la même liste
       * complète. L'infobulle n'existe que pour l'éviter à la souris.
       */
      const auDoigt = (evenement: PointerEvent) => evenement.pointerType === 'touch'

      arg.el.addEventListener('pointerenter', (evenement: Event) => {
        const pointeur = evenement as PointerEvent
        if (auDoigt(pointeur)) return
        afficher(pointeur)
      })
      arg.el.addEventListener('pointermove', (evenement: Event) => {
        const pointeur = evenement as PointerEvent
        if (auDoigt(pointeur)) return
        positionnerInfobulle(infobulle, pointeur)
      })
      arg.el.addEventListener('pointerleave', masquerInfobulleCreneau)
      // Un stylet ou une souris peut quitter la page sans repasser par le créneau ; et un appui
      // tactile qui aurait malgré tout ouvert l'infobulle ne doit pas la laisser derrière lui.
      arg.el.addEventListener('pointercancel', masquerInfobulleCreneau)
    },

    // Rendu HTML personnalisé pour les événements
    eventContent: (arg: any) => {
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
      const slotTitle = event.extendedProps.slotTitle || String(event.title).split(' (')[0]
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
    select: (selectInfo: any) => {
      if (!isReadOnly.value && onTimeSlotCreate) {
        onTimeSlotCreate(
          versInstantDuLieu(selectInfo.start),
          versInstantDuLieu(selectInfo.end),
          selectInfo.resource?.id
        )
      }
      // Désélectionner après la création
      nextTick(() => {
        calendarRef.value?.getApi?.()?.unselect()
      })
    },

    // Gestion des événements
    eventClick: (info: any) => {
      // En mode lecture seule, permettre le clic pour afficher les détails (onTimeSlotClick)
      // mais pas pour éditer (onTimeSlotUpdate)
      const callback = isReadOnly.value ? onTimeSlotClick : onTimeSlotClick || onTimeSlotUpdate
      // Le clic ouvre une modale : l'infobulle ne doit pas rester par-dessus.
      masquerInfobulleCreneau()
      if (callback) callback(creneauDepuisEvenement(info.event))
    },

    /**
     * Vue ou date changée : le calendrier appelle ce rappel dans les deux cas, y compris sur les
     * flèches de navigation. C'est donc le seul point d'où l'URL peut suivre ce qu'on regarde.
     *
     * `currentStart` : sur la vue semaine, c'est la date réellement affichée à gauche, celle qu'il
     * faut redonner au calendrier pour retrouver la même image.
     */
    datesSet: (info: any) => {
      if (!onVueChange) return
      const jour: Date = info.view.currentStart ?? info.start
      onVueChange(info.view.type, heureMurale(jour).slice(0, 10))
    },

    // Drag & drop des événements. `newResource` n'est rempli que si l'équipe a changé.
    eventDrop: (info: any) => {
      if (onTimeSlotUpdate) {
        onTimeSlotUpdate(creneauDepuisEvenement(info.event, info.newResource?.id))
      }
    },

    // Redimensionnement des événements
    eventResize: (info: any) => {
      if (onTimeSlotUpdate) onTimeSlotUpdate(creneauDepuisEvenement(info.event))
    },
  })

  // L'édition se charge en asynchrone : le calendrier est souvent construit AVANT que son fuseau
  // soit connu. Sans ce watcher, il resterait sur l'heure du navigateur, et seul un rechargement
  // complet afficherait les bonnes heures. Les créneaux suivent d'eux-mêmes : `events` dépend
  // du fuseau.
  watch(fuseauDuCalendrier, (nouveau) => {
    calendarOptions.timeZone = decalageDuFuseau(nouveau)
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
      // Les créneaux sont redessinés : l'infobulle d'un créneau disparu ne doit pas survivre.
      if (import.meta.client) masquerInfobulleCreneau()
      calendarOptions.events = newEvents
    },
    { deep: true, immediate: true }
  )

  /**
   * Pose la frise sur le premier créneau, une seule fois.
   *
   * Les créneaux arrivent après le premier rendu : la position ne peut donc pas être calculée
   * à la construction des options. Elle est appliquée au premier chargement qui en rapporte au
   * moins un, puis plus jamais — la replacer à chaque ajout ramènerait le défaut que les tests
   * de position verrouillent déjà, où remplir un planning obligeait à refaire défiler la frise
   * après chaque geste.
   *
   * ⚠️ Une position à part, et non `scrollTime` : EventCalendar plafonne celui-ci à la journée,
   * alors que le premier créneau peut tomber le lendemain (« 34:00:00 »). Le composant
   * `UiLazyEventCalendar` la pose lui-même (prop `defilement`).
   */
  const positionPosee = ref(false)
  const positionInitiale = ref<string | null>(null)

  watch(
    [startDate, () => unref(timeSlots)],
    ([debut, creneaux]) => {
      if (positionPosee.value || !creneaux || creneaux.length === 0) return

      const position = positionInitialeDuPlanning(debut, creneaux, fuseauDuCalendrier.value)
      positionPosee.value = true
      if (!position) return

      positionInitiale.value = position
    },
    { immediate: true }
  )

  /**
   * Recale le calendrier sur la période à couvrir, et seulement quand elle change.
   *
   * `timeSlots` figurait aussi dans la liste surveillée, pour le mode lecture seule où les
   * bornes se déduisent des créneaux. C'était superflu — `startDate` et `endDate` sont des
   * `computed` qui en dépendent déjà — et cela coûtait cher en gestion : ajouter ou supprimer
   * un créneau réécrivait la date affichée, ce qui ramenait la frise à son premier jour. On
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

      calendarOptions.date = String(newStartDate).slice(0, 10)
      calendarOptions.validRange = {
        start: String(newStartDate).slice(0, 10),
        end: String(newEndDate).slice(0, 10),
      }
      calendarOptions.views.resourceTimelineWeek.duration = {
        days: joursDeLaVueSemaine(newStartDate, newEndDate),
      }
    },
    { immediate: true }
  )

  // Granularité : le composant renvoie l'option au calendrier monté, qui se redessine seul (plus
  // besoin de `setOption` à la main ni de `refetchEvents`, comme avec FullCalendar).
  watch(slotDurationMinutes, (newDuration) => {
    calendarOptions.slotDuration = `00:${String(newDuration).padStart(2, '0')}:00`
    calendarOptions.slotWidth = slotWidthPour(newDuration)
  })

  // Plus de greffons à charger : EventCalendar arrive d'un bloc, chargé par le composant.
  onMounted(() => {
    ready.value = true
  })

  onBeforeUnmount(() => {
    if (import.meta.client) masquerInfobulleCreneau()
  })

  return {
    calendarRef,
    calendarOptions,
    ready,
    positionInitiale,
  }
}

/**
 * Largeur d'une case de la frise, pour qu'une heure fasse à peu près la même largeur (60 px)
 * quelle que soit la granularité — comme sous FullCalendar, où élargir la granularité ne
 * changeait pas l'échelle de lecture.
 */
function slotWidthPour(minutes: number): number {
  return Math.max(12, Math.round((60 * minutes) / 60))
}

/**
 * Nombre de jours de la vue « semaine » : ceux de la période autorisée, sept au plus.
 *
 * EventCalendar affiche toute la durée de la vue, jours hors période compris (grisés). Une
 * édition de trois jours s'ouvrait donc sur trois jours utiles et quatre colonnes vides ;
 * FullCalendar, lui, rognait la vue à la période. `end` est exclusif.
 */
export function joursDeLaVueSemaine(debut: string, fin: string): number {
  const ecart = Math.round(
    (Date.parse(`${String(fin).slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${String(debut).slice(0, 10)}T00:00:00Z`)) /
      86_400_000
  )
  return Number.isFinite(ecart) ? Math.min(7, Math.max(1, ecart)) : 7
}
