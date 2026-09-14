import { DateTime as dt } from 'luxon'

import type { DateTime } from 'luxon'
import type { FenetrePresence } from '~~/shared/utils/presence-benevole'
import type { Representation, SpectacleProgramme } from '~~/shared/utils/spectacles-visibles'

import { estPresentPendant, fenetreDe } from '~~/shared/utils/presence-benevole'
import { representationsDe, spectacleInaccessible } from '~~/shared/utils/spectacles-visibles'

export interface VolunteerApplication {
  id: number
  user: {
    id: number
    pseudo: string
    // `| null` : ce sont des colonnes nullables. Les déclarer seulement optionnelles obligeait
    // l'appelant à convertir ce que la base lui donne, ou — comme ici — à ne pas être vérifié.
    nom?: string | null
    prenom?: string | null
  }
  availability: string // JSON string avec les préférences
  motivation: string
  phone?: string | null
  teamPreferences?: any[]
  /**
   * Équipes dans lesquelles les organisateurs ont déjà placé le bénévole. À distinguer des
   * préférences, qui sont ce que le bénévole a demandé : ici, la décision est déjà prise.
   */
  assignedTeams?: string[]
  /**
   * Quand le bénévole arrive et repart, au format `YYYY-MM-DD_moment` que porte sa candidature.
   *
   * Renseignés par le bénévole lui-même, et lus jusqu'ici par le seul module repas : le
   * planificateur pouvait donc attribuer un créneau du vendredi à quelqu'un qui arrive le samedi.
   */
  arrivalDateTime?: string | null
  departureDateTime?: string | null
}

/**
 * Une affectation que le calcul ne remet pas en cause, mais dont il doit tenir compte.
 *
 * En mode « conserver », un bénévole déjà placé sur un créneau restait candidat à des heures
 * supplémentaires sans que les siennes comptent — ou, pire, était écarté en bloc du calcul. Ces
 * affectations pèsent donc dans ses heures, occupent son temps, et ferment l'accès aux spectacles
 * qu'elles recouvrent, exactement comme celles que le calcul vient de poser.
 *
 * Elles portent leurs propres bornes : un créneau d'équipe autonome n'est pas dans `timeSlots`,
 * puisque le calcul ne le remplit pas — il n'en occupe pas moins la soirée du bénévole.
 */
export interface AffectationExistante {
  volunteerId: number
  slotId: string
  start: string
  end: string
}

export interface TimeSlot {
  id: string
  title: string
  start: string
  end: string
  teamId?: string
  maxVolunteers: number
  assignedVolunteers: number
  description?: string
}

/**
 * Bornes de l'événement, qui séparent le montage de l'événement et l'événement du démontage.
 * Ce sont des instants complets : un créneau de montage le matin du jour d'ouverture, avant
 * l'heure de début, relève bien du montage.
 */
export interface BornesEvenement {
  debut?: string | null
  fin?: string | null
}

export interface Team {
  id: string
  name: string
  color: string
  /**
   * L'effectif que l'équipe souhaite, quand elle en déclare un.
   *
   * ⚠️ C'est un INDICATEUR, pas un plafond — la décision a été prise pour les statistiques
   * d'équipe et vaut ici : une équipe qui déclare huit personnes n'en refuse pas une neuvième,
   * elle dit combien il lui en faudrait. Le moteur s'en sert donc comme d'une préférence, et non
   * comme d'un refus : au-delà de l'effectif souhaité, l'équipe devient moins attirante que
   * celles qui manquent encore de monde.
   */
  maxVolunteers?: number | null
}

export interface Assignment {
  volunteerId: number
  slotId: string
  teamId?: string
  score: number
  confidence: number
}

/**
 * Pourquoi un bénévole ne peut pas tenir un créneau.
 *
 * Le moteur connaissait déjà chacune de ces raisons — il les traduisait en score −1000 et les
 * jetait. L'organisateur se retrouvait devant une liste de bénévoles non assignés sans savoir quel
 * réglage relâcher, ce qui est précisément la question qu'il se pose.
 *
 * Des codes, pas des phrases : c'est l'écran qui les traduit, dans la langue de qui regarde.
 */
export type MotifRefus =
  | 'indisponible'
  | 'absent'
  | 'equipe-non-souhaitee'
  | 'hors-equipe-assignee'
  | 'hors-plage-horaire'
  | 'plafond-journalier'
  | 'chevauchement'
  | 'acces-spectacle'
  | 'plafond-heures'

/** Un message destiné à l'organisateur, à traduire par l'écran. */
export interface MessageResultat {
  code: string
  params?: Record<string, number | string>
}

export interface SchedulingConstraints {
  maxHoursPerVolunteer?: number
  minHoursPerVolunteer?: number
  maxHoursPerDay?: number
  minHoursPerDay?: number
  balanceTeams?: boolean
  respectStrictAvailability?: boolean
  respectStrictTeamPreferences?: boolean
  respectStrictAssignedTeams?: boolean
  /**
   * Refuse d'affecter un bénévole à un créneau qui refermerait le dernier passage d'un
   * spectacle. Sans cela, l'algorithme prive tranquillement des gens de la seule chose qu'ils
   * étaient peut-être venus voir.
   */
  preserverAccesSpectacles?: boolean
  respectStrictTimePreferences?: boolean
  allowOvertime?: boolean
  maxOvertimeHours?: number
}

export interface SchedulingResult {
  assignments: Assignment[]
  unassigned: {
    volunteers: number[]
    slots: string[]
  }
  stats: {
    totalAssignments: number
    averageHoursPerVolunteer: number
    /**
     * ⚠️ Conservé pour ne pas casser un appel existant, mais il ne mesure rien d'observable :
     * c'était la moyenne des `confidence`, elles-mêmes dérivées du score. La métrique disait à
     * quel point l'algorithme était content de lui, pas à quel point les bénévoles étaient
     * servis — « 78 % de satisfaction » ne correspondait à aucune quantité constatable.
     *
     * Les indicateurs ci-dessous le remplacent, et ils se vérifient un par un sur le planning.
     */
    satisfactionRate: number
    balanceScore: number
    /** Part des préférences d'équipe honorées, parmi les affectations à une équipe. */
    preferencesEquipeHonorees: number
    /** Part des affectations qui tombent dans une plage horaire souhaitée. */
    creneauxDansLesHorairesSouhaites: number
    /** Part des bénévoles qui atteignent le minimum d'heures demandé. */
    benevolesAuMinimumDHeures: number
    /** Part des créneaux entièrement pourvus. */
    creneauxComplets: number
    /** Écart-type des heures, en heures : zéro signifie que tout le monde en fait autant. */
    ecartTypeDesHeures: number
  }
  warnings: MessageResultat[]
  recommendations: MessageResultat[]
  /**
   * Pourquoi ça n'a pas marché.
   *
   * Par bénévole : le motif qui l'a écarté le plus souvent — celui qu'il faut relâcher en premier
   * pour lui trouver une place. Par créneau : combien de candidats chaque contrainte a écartés,
   * ce qui dit à l'organisateur quel curseur bouger plutôt que de le laisser deviner.
   */
  refus: {
    parBenevole: { volunteerId: number; motif: MotifRefus }[]
    parCreneau: { slotId: string; motifs: { motif: MotifRefus; candidats: number }[] }[]
  }
}

/**
 * Les poids et les seuils du calcul, rassemblés.
 *
 * Ils étaient une vingtaine, disséminés dans le corps de `calculateAssignmentScore` sous forme de
 * nombres nus commentés « bonus urgence » ou « forte pénalité ». Impossible de savoir, en les
 * lisant un par un, si l'ensemble était cohérent — et il ne l'était pas :
 *
 * ⚠️ **La pénalité de dépassement journalier valait −80 quand le seuil d'acceptation est à −50.**
 * Un créneau en heures supplémentaires partait donc à −50 exactement (20 de disponibilité + 10
 * d'urgence − 80), soit sous un seuil strict : il n'était JAMAIS retenu. Le réglage
 * `allowOvertime` promettait un dépassement encadré et ne produisait rien. Il fallait qu'un
 * bénévole cumule des bonus par ailleurs pour seulement atteindre le cas que le réglage prétend
 * autoriser.
 *
 * La pénalité est ramenée à une valeur qui pèse sans interdire : une journée déjà pleine devient
 * le dernier choix, pas un choix impossible. Les impossibilités, elles, sont traitées ailleurs —
 * par `motifBloquant`, qui rend un motif nommé plutôt qu'un nombre.
 */
const POIDS = {
  /** Le bénévole est disponible sur la phase du créneau. */
  DISPONIBLE: 20,
  /** Il ne l'est pas, mais le mode strict est désactivé : on peut, on préfère éviter. */
  INDISPONIBLE_TOLERE: -50,
  /** Le créneau relève d'une équipe qu'il a demandée. */
  EQUIPE_SOUHAITEE: 15,
  /** Le créneau relève d'une équipe où un organisateur l'a placé. */
  EQUIPE_ASSIGNEE: 15,
  /** Le créneau tombe dans une plage horaire souhaitée, au prorata du recouvrement. */
  PLAGE_HORAIRE: 12,
  /**
   * Dépassement du total, dans la limite des heures supplémentaires autorisées.
   *
   * Les deux autres cas — dépasser sans heures supplémentaires, ou dépasser au-delà de ce qu'elles
   * permettent — valaient ici −100 et −200. Ce sont désormais des impossibilités nommées, rendues
   * par `motifBloquant` : une pénalité de score, même forte, reste franchissable par accumulation
   * de bonus, et ne dit rien à l'organisateur.
   */
  DEPASSEMENT_TOTAL_TOLERE: -20,
  /**
   * Dépassement du plafond JOURNALIER, dans la limite autorisée.
   *
   * Valait −80, ce qui plaçait le créneau sous le seuil d'acceptation et rendait `allowOvertime`
   * décoratif. À −25, une journée déjà pleine reste le dernier choix sans devenir impossible.
   */
  DEPASSEMENT_JOURNALIER_TOLERE: -25,
  /** Première heure de la journée pour ce bénévole : elle vaut mieux qu'une de plus ailleurs. */
  AMORCE_DE_JOURNEE: 5,
  /** Le créneau touche à sa fin de remplissage : mieux vaut le pourvoir qu'en entamer un autre. */
  URGENCE: 10,
  /** Écart à la moyenne d'heures, par heure d'écart — en dessous, puis au-dessus. */
  SOUS_LA_MOYENNE: 1.5,
  AU_DESSUS_DE_LA_MOYENNE: -2,
  /** Effectif d'équipe dépassé, par personne en trop, et le plafond de cette pénalité. */
  EFFECTIF_DEPASSE: -8,
  EFFECTIF_DEPASSE_MAX: -40,
  /** Le plancher du score : au-delà, c'est une impossibilité, et elle porte un motif. */
  IMPOSSIBLE: -1000,
} as const

/**
 * À partir de quel score une affectation est retenue, et par quelle passe.
 *
 * La première ne prend que les évidences, la seconde remplit ce qui reste. L'écart entre les deux
 * est ce qui fait qu'un bénévole idéal pour un créneau n'est pas consommé par un créneau
 * quelconque rencontré plus tôt.
 */
/**
 * Les plages horaires que le formulaire propose, en heures locales de l'événement.
 *
 * `late_evening` franchit minuit, et c'est la seule : son `fin` plus petit que son `debut` le dit,
 * et le calcul de recouvrement le traite comme tel plutôt que par un cas particulier.
 */
const PLAGES_HORAIRES = {
  early_morning: { debut: 6, fin: 9 },
  morning: { debut: 9, fin: 12 },
  lunch: { debut: 12, fin: 14 },
  early_afternoon: { debut: 14, fin: 17 },
  late_afternoon: { debut: 17, fin: 20 },
  evening: { debut: 20, fin: 23 },
  late_evening: { debut: 23, fin: 2 },
  night: { debut: 2, fin: 6 },
} as const

const SEUILS = {
  EVIDENCE: 50,
  REMPLISSAGE: -50,
  /**
   * En mode strict, quelle part du créneau doit tomber dans les plages souhaitées.
   *
   * La moitié, et non la totalité : quelqu'un qui a coché « matin » n'a pas dit qu'il refusait un
   * créneau de 10 h à 13 h. Exiger 100 % rendrait le mode strict inapplicable dès qu'un créneau
   * chevauche deux plages, ce qui est le cas le plus courant.
   */
  RECOUVREMENT_MINIMAL: 0.5,
} as const

/** Ce qui borne le rééquilibrage : jusqu'où insister, et à partir de quand un écart mérite qu'on bouge. */
const LIMITES = {
  /** Assez pour converger sur une édition réelle, assez peu pour ne pas tourner en rond. */
  PASSES_DE_REEQUILIBRAGE: 20,
  /** L'écart à la moyenne au-delà duquel un bénévole est jugé sur- ou sous-chargé, en heures. */
  ECART_DE_CHARGE: 2,
  /** En deçà, transférer ne rééquilibre rien et risque d'osciller d'une passe à l'autre. */
  ECART_UTILE: 3,
  /**
   * Combien de créneaux vides on tente de débloquer par déplacement.
   *
   * Chaque tentative parcourt les affectations et les bénévoles : la borne garde ce rattrapage
   * proportionné au calcul qu'il complète, sur une édition où beaucoup de créneaux resteraient
   * vides faute de monde — cas où aucun déplacement n'y changerait rien.
   */
  CRENEAUX_A_DEBLOQUER: 50,
} as const

export class VolunteerScheduler {
  private volunteers: VolunteerApplication[] = []
  private timeSlots: TimeSlot[] = []
  private teams: Team[] = []
  private constraints: SchedulingConstraints = {}
  private assignments: Assignment[] = []
  private bornes: BornesEvenement = {}
  /**
   * Les représentations de chaque spectacle, bornées une fois pour toutes : la garde consulte
   * cette liste à chaque affectation envisagée, et re-parser les dates à chaque fois n'y
   * apprendrait rien de nouveau. Les spectacles sans représentation lisible sont écartés ici,
   * puisqu'ils n'offrent rien à manquer.
   */
  private representationsParSpectacle: Representation[][] = []
  /**
   * Les affectations déjà en place que le calcul conserve. Elles pèsent dans les heures et
   * occupent le temps, mais ne figureront pas dans le résultat : ce sont des faits, pas des
   * décisions à prendre.
   */
  private affectationsExistantes: AffectationExistante[] = []
  /**
   * La fenêtre de présence de chaque bénévole, calculée une fois. La garde la consulte à chaque
   * affectation envisagée, et re-lire « 2026-08-01_morning » à chaque fois n'y apprendrait rien.
   */
  private presenceParBenevole = new Map<number, FenetrePresence>()
  /**
   * Le fuseau de l'événement, au format IANA.
   *
   * Toutes les heures et toutes les journées du moteur s'y lisent. Sans lui, « 23 h 30 » se
   * comprenait dans le fuseau du processus — UTC en conteneur —, si bien qu'un créneau de soirée
   * était vu comme un créneau d'après-midi, et rattaché au jour précédent pour le plafond
   * journalier. Sur une convention à Paris en été, deux heures d'écart et un jour de décalage.
   *
   * `null` retombe sur UTC : c'est un repli pour les éditions qui n'ont pas renseigné leur
   * fuseau, pas une intention.
   */
  private fuseau: string | null = null

  /**
   * Les index qui rendent le calcul praticable.
   *
   * Tout était recalculé à chaque évaluation de score : les heures d'un bénévole par un `filter`
   * sur toutes les affectations doublé d'un `find` linéaire sur tous les créneaux, la moyenne en
   * refaisant cela pour chaque bénévole. Comme le score est évalué pour chaque paire (bénévole,
   * créneau), le coût atteignait O(V² × S² × A).
   *
   * Mesuré avant : 3 s pour 50 bénévoles et 60 créneaux, 33 s pour 100 × 150, **4 min 42 pour
   * 200 × 300** — et ce calcul était fait deux fois, à l'aperçu puis à l'application.
   *
   * Ces compteurs sont tenus à jour à chaque affectation posée ou retirée. C'est la seule
   * discipline qu'ils imposent : passer par `enregistrerAffectation` et `retirerAffectation`, et
   * ne jamais toucher `this.assignments` directement.
   */
  private creneauParId = new Map<string, TimeSlot>()
  private dureeParCreneau = new Map<string, number>()
  private jourParCreneau = new Map<string, string>()
  private heuresParBenevole = new Map<number, number>()
  private heuresParJour = new Map<number, Map<string, number>>()
  private creneauxParBenevole = new Map<number, { debut: number; fin: number; slotId: string }[]>()
  private totalHeuresPosees = 0
  /**
   * Le motif qui a écarté chaque paire (bénévole, créneau), relevé AU MOMENT du refus.
   *
   * Il était reconstitué après coup, en réévaluant tout sur l'état final — ce qui coûtait un second
   * balayage complet et disait parfois autre chose que la vérité : un bénévole libre au moment où
   * le créneau a été distribué pouvait y apparaître comme « déjà pris », parce qu'on lui avait
   * donné autre chose entre-temps.
   *
   * Le relever ici ne coûte rien : le motif est déjà calculé par `calculateAssignmentScore`, qui
   * se contentait de le jeter.
   *
   * ⚠️ Une paire sans entrée n'a été bloquée par AUCUNE contrainte — elle a simplement été moins
   * bien classée. C'est une réponse différente pour l'organisateur : relâcher un réglage n'y
   * changera rien, il manque des créneaux ou des heures.
   */
  private motifParPaire = new Map<string, MotifRefus>()

  constructor(
    volunteers: VolunteerApplication[],
    timeSlots: TimeSlot[],
    teams: Team[],
    constraints: SchedulingConstraints = {},
    bornes: BornesEvenement = {},
    spectacles: SpectacleProgramme[] = [],
    affectationsExistantes: AffectationExistante[] = [],
    fuseau: string | null = null
  ) {
    this.volunteers = volunteers
    /**
     * Une COPIE des créneaux, et c'est essentiel.
     *
     * Le moteur incrémente `assignedVolunteers` au fil des affectations. Tant qu'il le faisait sur
     * les objets de l'appelant, deux conséquences : on ne pouvait pas relancer un calcul sur le
     * même tableau — le second les voyait déjà remplis — et l'appelant perdait l'état d'avant, donc
     * toute possibilité de comparer.
     *
     * Ce dernier point est le verrou qui empêchait de faire tourner deux algorithmes sur les mêmes
     * données pour confronter leurs résultats.
     *
     * ⚠️ Copie de surface : elle suffit parce que seul `assignedVolunteers` est muté, et qu'il est
     * un nombre. Muter autre chose demanderait de revoir cette ligne.
     */
    this.timeSlots = timeSlots.map((slot) => ({ ...slot }))
    this.teams = teams
    this.bornes = bornes
    this.affectationsExistantes = affectationsExistantes
    this.fuseau = fuseau
    this.presenceParBenevole = new Map(
      volunteers.map((volunteer) => [volunteer.user.id, fenetreDe(volunteer, fuseau)])
    )
    this.representationsParSpectacle = spectacles
      .map(representationsDe)
      .filter((representations) => representations.length > 0)

    // Les créneaux sont indexés une fois : le `find` linéaire qu'ils remplacent était exécuté
    // des millions de fois sur une grosse édition.
    for (const slot of this.timeSlots) {
      this.creneauParId.set(slot.id, slot)
      const debut = dt.fromISO(slot.start)
      const fin = dt.fromISO(slot.end)
      this.dureeParCreneau.set(slot.id, fin.diff(debut, 'hours').hours)
      this.jourParCreneau.set(
        slot.id,
        (fuseau ? debut.setZone(fuseau) : debut.toUTC()).toISODate() ?? ''
      )
    }

    // Les affectations déjà en place comptent dès le départ : ce sont des heures tenues.
    for (const affectation of affectationsExistantes) {
      const debut = dt.fromISO(affectation.start)
      const fin = dt.fromISO(affectation.end)
      const duree = fin.diff(debut, 'hours').hours
      const jour = (fuseau ? debut.setZone(fuseau) : debut.toUTC()).toISODate() ?? ''

      this.ajouterHeures(affectation.volunteerId, jour, Number.isFinite(duree) ? duree : 0)
      this.ajouterCreneauTenu(affectation.volunteerId, {
        debut: debut.toMillis(),
        fin: fin.toMillis(),
        slotId: affectation.slotId,
      })
    }
    this.constraints = {
      maxHoursPerVolunteer: 12,
      minHoursPerVolunteer: 2,
      maxHoursPerDay: 8,
      minHoursPerDay: 1,
      balanceTeams: true,
      respectStrictAvailability: true,
      allowOvertime: false,
      maxOvertimeHours: 2,
      preserverAccesSpectacles: true,
      ...constraints,
    }
  }

  /**
   * Lance l'algorithme d'assignation automatique
   */
  public assignVolunteers(): SchedulingResult {
    this.assignments = []

    // 1. Préparation des données
    const availableVolunteers = this.getAvailableVolunteers()
    const sortedSlots = this.getSortedSlots()

    // 2. Première passe : assignations évidentes (forte préférence + expérience)
    this.assignHighPriorityMatches(availableVolunteers, sortedSlots)

    // 3. Deuxième passe : remplissage optimal
    this.assignRemainingSlots(availableVolunteers, sortedSlots)

    // 4. Troisième passe : équilibrage si nécessaire
    if (this.constraints.balanceTeams) {
      this.balanceAssignments()
    }

    // 5. Quatrième passe : débloquer les créneaux qu'un ordre de parcours malheureux a laissés
    //    vides, en déplaçant quelqu'un d'autre.
    this.comblerLesCreneauxVides()

    // 5. Génération des résultats
    return this.generateResults()
  }

  /**
   * Un instant, lu dans le fuseau de l'événement.
   *
   * Le seul endroit du moteur qui convertit : toute heure et toute journée passent par ici, pour
   * qu'aucun calcul ne puisse retomber par inadvertance sur le fuseau du processus.
   */
  private local(iso: string): DateTime {
    const instant = dt.fromISO(iso)
    return this.fuseau ? instant.setZone(this.fuseau) : instant.toUTC()
  }

  /**
   * Le début d'une journée, à partir d'une date NUE (`2026-08-01`).
   *
   * Distinct de `local` et il faut qu'il le soit : une date nue n'est pas un instant. La passer à
   * `local` la faisait interpréter dans le fuseau du processus avant d'être convertie, si bien que
   * « le 1er août » devenait le 31 juillet à 22 h pour un processus à Paris — et plus aucune
   * journée ne correspondait à elle-même. Le plafond quotidien ne mordait alors jamais.
   */
  private jourLocal(dateNue: string): DateTime {
    return dt.fromISO(dateNue, { zone: this.fuseau ?? 'utc' }).startOf('day')
  }

  /** Ajoute des heures au bénévole, au total et pour la journée concernée. */
  private ajouterHeures(volunteerId: number, jour: string, heures: number) {
    this.heuresParBenevole.set(volunteerId, (this.heuresParBenevole.get(volunteerId) ?? 0) + heures)
    const parJour = this.heuresParJour.get(volunteerId) ?? new Map<string, number>()
    parJour.set(jour, (parJour.get(jour) ?? 0) + heures)
    this.heuresParJour.set(volunteerId, parJour)
  }

  private ajouterCreneauTenu(
    volunteerId: number,
    creneau: { debut: number; fin: number; slotId: string }
  ) {
    const tenus = this.creneauxParBenevole.get(volunteerId) ?? []
    tenus.push(creneau)
    this.creneauxParBenevole.set(volunteerId, tenus)
  }

  /**
   * Pose une affectation, et met à jour tout ce qui en dépend.
   *
   * **Le seul chemin autorisé** pour ajouter à `this.assignments` : les compteurs d'heures, les
   * créneaux tenus et le total ne se maintiennent pas tout seuls. Une affectation posée à côté
   * rendrait les plafonds aveugles, ce qui est exactement le genre de panne silencieuse que ce
   * lot cherche à éviter.
   */
  private enregistrerAffectation(assignment: Assignment) {
    this.assignments.push(assignment)
    this.enregistrerAffectationSansAjout(assignment)
  }

  /** Retire une affectation d'un bénévole — le pendant exact, pour le rééquilibrage. */
  private retirerAffectation(assignment: Assignment) {
    const slot = this.creneauParId.get(assignment.slotId)
    if (!slot) return

    const duree = this.dureeParCreneau.get(slot.id) ?? 0
    const jour = this.jourParCreneau.get(slot.id) ?? ''

    this.ajouterHeures(assignment.volunteerId, jour, -duree)
    this.totalHeuresPosees -= duree

    const tenus = this.creneauxParBenevole.get(assignment.volunteerId) ?? []
    const index = tenus.findIndex((creneau) => creneau.slotId === slot.id)
    if (index >= 0) tenus.splice(index, 1)
  }

  /**
   * Ce qui rend un créneau impossible pour ce bénévole, ou `null` s'il est envisageable.
   *
   * **Écrit une fois, lu deux fois** : par le score, qui en fait un −1000, et par le diagnostic,
   * qui l'explique à l'organisateur. Les faire diverger produirait un écran qui affirme une raison
   * pendant que le moteur en applique une autre.
   *
   * L'ordre compte : on rend le PREMIER motif rencontré, et il est rangé du plus déterminant au
   * plus circonstanciel. Qu'un bénévole soit absent prime sur le fait que le créneau relève d'une
   * équipe qu'il n'a pas demandée.
   */
  private motifBloquant(
    volunteer: VolunteerApplication,
    slot: TimeSlot,
    availability: any
  ): MotifRefus | null {
    if (
      this.constraints.respectStrictAvailability &&
      !this.isVolunteerAvailable(volunteer, slot, availability)
    ) {
      return 'indisponible'
    }

    const presence = this.presenceParBenevole.get(volunteer.user.id)
    if (
      presence &&
      !estPresentPendant(presence, {
        debut: new Date(slot.start).getTime(),
        fin: new Date(slot.end).getTime(),
      })
    ) {
      return 'absent'
    }

    if (slot.teamId) {
      const souhaitee = volunteer.teamPreferences?.some((pref) => pref === slot.teamId)
      if (
        !souhaitee &&
        this.constraints.respectStrictTeamPreferences &&
        volunteer.teamPreferences &&
        volunteer.teamPreferences.length > 0
      ) {
        return 'equipe-non-souhaitee'
      }

      const placeDedans = volunteer.assignedTeams?.some((teamId) => teamId === slot.teamId)
      if (
        !placeDedans &&
        this.constraints.respectStrictAssignedTeams &&
        volunteer.assignedTeams &&
        volunteer.assignedTeams.length > 0
      ) {
        return 'hors-equipe-assignee'
      }
    }

    if (
      this.constraints.respectStrictTimePreferences &&
      Array.isArray(availability.timePreferences) &&
      availability.timePreferences.length > 0 &&
      this.recouvrementDesPreferences(slot, availability) < SEUILS.RECOUVREMENT_MINIMAL
    ) {
      return 'hors-plage-horaire'
    }

    /**
     * Le plafond TOTAL d'heures, désormais nommé comme les autres impossibilités.
     *
     * Il n'était qu'une pénalité de score, avec deux conséquences : un bénévole écarté pour avoir
     * atteint son maximum n'apparaissait avec AUCUN motif — sur un écran fait pour en donner un —
     * et la première passe ne le vérifiait pas du tout, seule la seconde le faisait. Un bénévole
     * cumulant assez de bonus pouvait donc dépasser son plafond en première passe.
     *
     * Même forme que le plafond journalier : les heures supplémentaires le desserrent quand elles
     * sont autorisées, elles ne le suppriment pas.
     */
    const heuresTenues = this.getCurrentVolunteerHours(volunteer.user.id)
    const dureeDuCreneau = this.getSlotDuration(slot)
    const plafondTotal = this.constraints.maxHoursPerVolunteer || 12

    if (heuresTenues + dureeDuCreneau > plafondTotal) {
      if (!this.constraints.allowOvertime) return 'plafond-heures'
      if (heuresTenues + dureeDuCreneau > plafondTotal + (this.constraints.maxOvertimeHours || 2)) {
        return 'plafond-heures'
      }
    }

    if (!this.checkDailyHoursConstraints(volunteer.user.id, slot)) {
      if (!this.constraints.allowOvertime) return 'plafond-journalier'
      if (!this.checkDailyHoursConstraints(volunteer.user.id, slot, true)) {
        return 'plafond-journalier'
      }
    }

    if (this.hasTimeConflict(volunteer.user.id, slot.id)) return 'chevauchement'
    if (this.priveDuDernierPassage(volunteer.user.id, slot)) return 'acces-spectacle'

    return null
  }

  /**
   * Comble les créneaux restés vides en déplaçant quelqu'un d'autre.
   *
   * L'algorithme est glouton : il sert le meilleur candidat du moment, créneau après créneau, et
   * ne revient jamais sur ce qu'il a posé. Le cas qui le piège est net, et il se reproduit :
   *
   * > Un bénévole accepte l'équipe « banale » et l'équipe « pointue ». Il est le SEUL à accepter
   * > la pointue. Le créneau banal est rencontré en premier, il le prend, son plafond d'heures est
   * > atteint — et le créneau pointu reste vide, alors qu'un autre bénévole aurait très bien pu
   * > tenir le banal.
   *
   * Une permutation ne corrige pas cela : il n'y a qu'une affectation à échanger. Ce qu'il faut,
   * c'est un DÉPLACEMENT — quelqu'un d'autre reprend le créneau banal, ce qui libère celui qui
   * seul peut tenir le pointu.
   *
   * ⚠️ Mesuré : une phase de permutations classique n'apportait rien sur un jeu réaliste
   * (mêmes préférences honorées, mêmes créneaux pourvus) tout en coûtant quarante-huit secondes
   * sur une grosse édition. Elle a été écartée au profit de celle-ci, qui corrige un défaut
   * constaté plutôt qu'un défaut supposé.
   */
  private comblerLesCreneauxVides(): void {
    const vides = this.timeSlots.filter((slot) => slot.assignedVolunteers < slot.maxVolunteers)
    if (vides.length === 0) return

    for (const vide of vides.slice(0, LIMITES.CRENEAUX_A_DEBLOQUER)) {
      // Qui pourrait tenir ce créneau s'il était libéré d'un autre ? On ne s'intéresse qu'à ceux
      // qui tiennent déjà quelque chose : les autres ont déjà été proposés et écartés.
      const aDeplacer = this.assignments.find((assignment) => {
        const benevole = this.volunteers.find((v) => v.user.id === assignment.volunteerId)
        const creneauTenu = this.creneauParId.get(assignment.slotId)
        if (!benevole || !creneauTenu || creneauTenu.id === vide.id) return false

        // On évalue dans l'état où il aurait rendu son créneau.
        this.retirerAffectation(assignment)
        const peutPrendreLeVide =
          !this.motifBloquant(benevole, vide, this.parseAvailability(benevole.availability)) &&
          this.calculateAssignmentScore(benevole, vide) > SEUILS.REMPLISSAGE

        // Et quelqu'un d'autre doit pouvoir reprendre ce qu'il rend, sinon on déshabille Pierre.
        const remplacant = peutPrendreLeVide
          ? this.volunteers.find(
              (autre) =>
                autre.user.id !== benevole.user.id &&
                !this.motifBloquant(
                  autre,
                  creneauTenu,
                  this.parseAvailability(autre.availability)
                ) &&
                this.calculateAssignmentScore(autre, creneauTenu) > SEUILS.REMPLISSAGE
            )
          : undefined

        this.enregistrerAffectationSansAjout(assignment)
        if (!remplacant) return false

        // Le déplacement vaut la peine : on le fait ici, et on arrête de chercher pour ce créneau.
        this.retirerAffectation(assignment)
        assignment.volunteerId = remplacant.user.id
        const scoreRemplacant = this.calculateAssignmentScore(remplacant, creneauTenu)
        assignment.score = scoreRemplacant
        assignment.confidence = this.calculateConfidence(scoreRemplacant)
        this.enregistrerAffectationSansAjout(assignment)

        const scoreLibere = this.calculateAssignmentScore(benevole, vide)
        this.enregistrerAffectation({
          volunteerId: benevole.user.id,
          slotId: vide.id,
          teamId: vide.teamId,
          score: scoreLibere,
          confidence: this.calculateConfidence(scoreLibere),
        })
        vide.assignedVolunteers++

        return true
      })

      if (!aDeplacer) continue
    }
  }

  /**
   * Remet une affectation dans les compteurs sans la rajouter à la liste — elle y est déjà.
   *
   * `retirerAffectation` ne retire que des compteurs, pas du tableau : c'est ce qui permet
   * d'évaluer une permutation puis de revenir en arrière sans rien perdre.
   */
  private enregistrerAffectationSansAjout(assignment: Assignment) {
    const slot = this.creneauParId.get(assignment.slotId)
    if (!slot) return

    const duree = this.dureeParCreneau.get(slot.id) ?? 0
    this.ajouterHeures(assignment.volunteerId, this.jourParCreneau.get(slot.id) ?? '', duree)
    this.ajouterCreneauTenu(assignment.volunteerId, {
      debut: new Date(slot.start).getTime(),
      fin: new Date(slot.end).getTime(),
      slotId: slot.id,
    })
    this.totalHeuresPosees += duree
  }

  /**
   * Calcule le score d'assignation pour un bénévole et un créneau
   */
  private calculateAssignmentScore(volunteer: VolunteerApplication, slot: TimeSlot): number {
    let score = 0

    // Disponibilité du bénévole
    const availability = this.parseAvailability(volunteer.availability)
    const isAvailable = this.isVolunteerAvailable(volunteer, slot, availability)

    // Les impossibilités sont relevées ensemble, et nommées : le diagnostic lit la même méthode.
    const motif = this.motifBloquant(volunteer, slot, availability)
    if (motif) {
      // Relevé plutôt que jeté : c'est ce qui permet au diagnostic de dire pourquoi, sans
      // reconstituer après coup un état qui n'est plus celui du refus.
      this.motifParPaire.set(`${volunteer.user.id}:${slot.id}`, motif)
      return POIDS.IMPOSSIBLE
    }

    if (!isAvailable) {
      score += POIDS.INDISPONIBLE_TOLERE
    } else {
      score += POIDS.DISPONIBLE
    }

    // Préférence d'équipe
    if (slot.teamId) {
      // Les préférences sont stockées comme une liste d'identifiants d'équipe (z.array(z.string())
      // à la soumission). Les lire comme des objets `{ teamId }` ne trouvait jamais de
      // correspondance : le bonus n'était jamais accordé, et en mode strict le bénévole était
      // écarté de l'équipe qu'il avait justement demandée.
      const hasTeamPreference = volunteer.teamPreferences?.some((pref) => pref === slot.teamId)

      if (hasTeamPreference) {
        score += POIDS.EQUIPE_SOUHAITEE
      }

      // Équipe déjà assignée par les organisateurs. Le pendant des préférences, mais du côté
      // de la décision plutôt que du souhait : un bénévole placé dans une équipe a vocation à
      // y servir, et le mode strict interdit de l'en sortir.
      const estDansEquipeAssignee = volunteer.assignedTeams?.some(
        (teamId) => teamId === slot.teamId
      )

      if (estDansEquipeAssignee) {
        score += POIDS.EQUIPE_ASSIGNEE
      }
    }

    // L'équipe a-t-elle déjà l'effectif qu'elle demandait ?
    score += this.ecartEffectifEquipe(volunteer, slot)

    // Préférences horaires
    const timePreferenceBonus = this.calculateTimePreferenceBonus(volunteer, slot, availability)

    score += timePreferenceBonus

    /**
     * Charge de travail actuelle.
     *
     * Les deux cas d'impossibilité — dépassement sans heures supplémentaires, et dépassement
     * au-delà de ce qu'elles autorisent — sont traités par `motifBloquant`, qui les nomme. Ne
     * reste ici que le dépassement TOLÉRÉ : autorisé, donc pénalisé plutôt que refusé.
     */
    const currentHours = this.getCurrentVolunteerHours(volunteer.user.id)
    const slotDuration = this.getSlotDuration(slot)
    const maxHours = this.constraints.maxHoursPerVolunteer || 12

    if (currentHours + slotDuration > maxHours) {
      score += POIDS.DEPASSEMENT_TOTAL_TOLERE
    }

    /**
     * Contraintes d'heures par jour.
     *
     * Les heures supplémentaires desserrent le plafond journalier, elles ne le suppriment pas :
     * `maxOvertimeHours` borne le dépassement ici comme il borne le total. Sans cette borne, une
     * journée pouvait s'allonger indéfiniment tant que le total tenait — le plafond quotidien
     * n'était plus qu'une pénalité de 80 points, que quelques bonus suffisaient à effacer.
     */
    if (!this.checkDailyHoursConstraints(volunteer.user.id, slot)) {
      // L'impossibilité est déjà traitée par `motifBloquant` ; reste la pénalité du dépassement
      // autorisé.
      score += POIDS.DEPASSEMENT_JOURNALIER_TOLERE
    }

    // Vérification des heures minimum par jour
    const slotDate = this.local(slot.start).toISODate()
    const currentDailyHours = this.getVolunteerHoursForDate(volunteer.user.id, slotDate!)
    const minHoursPerDay = this.constraints.minHoursPerDay || 1

    if (currentDailyHours === 0 && slotDuration >= minHoursPerDay) {
      score += POIDS.AMORCE_DE_JOURNEE
    }

    // Équilibrage des heures
    const avgHours = this.getAverageHours()
    if (currentHours > avgHours) {
      score += Math.floor((currentHours - avgHours) * POIDS.AU_DESSUS_DE_LA_MOYENNE)
    } else if (currentHours < avgHours) {
      score += Math.floor((avgHours - currentHours) * POIDS.SOUS_LA_MOYENNE)
    }

    // Bonus si le créneau n'est pas encore complet
    const remainingSpots = slot.maxVolunteers - slot.assignedVolunteers
    if (remainingSpots <= 2) {
      score += POIDS.URGENCE
    }

    return Math.max(score, POIDS.IMPOSSIBLE)
  }

  /**
   * L'écart entre l'effectif souhaité par l'équipe du créneau et ceux qu'on y a déjà placés.
   *
   * Une pénalité, jamais un refus : `maxVolunteers` dit ce qu'il faudrait à l'équipe, pas ce
   * qu'elle accepte. En faire une contrainte dure laisserait des créneaux vides à côté de gens
   * disponibles, pour respecter un chiffre qui n'est qu'un objectif.
   *
   * Rend 0 dès que l'équipe ne déclare rien, ce qui est le cas le plus courant.
   */
  private ecartEffectifEquipe(volunteer: VolunteerApplication, slot: TimeSlot): number {
    if (!slot.teamId) return 0

    const equipe = this.teams.find((team) => team.id === slot.teamId)
    const souhaite = equipe?.maxVolunteers
    if (!souhaite || souhaite <= 0) return 0

    // Les personnes distinctes déjà placées dans cette équipe par ce calcul, plus celles que
    // les organisateurs y avaient mises. Un bénévole qui tient trois créneaux de la même équipe
    // ne compte qu'une fois : c'est un effectif, pas un nombre d'affectations.
    const membres = new Set<number>(
      this.assignments
        .filter((assignment) => assignment.teamId === slot.teamId)
        .map((assignment) => assignment.volunteerId)
    )

    for (const candidat of this.volunteers) {
      if (candidat.assignedTeams?.includes(slot.teamId)) membres.add(candidat.user.id)
    }

    // Celui qu'on envisage compte déjà : la question est « faut-il en ajouter un de plus ? »
    if (membres.has(volunteer.user.id)) return 0

    const depassement = membres.size + 1 - souhaite
    return depassement > 0
      ? Math.max(depassement * POIDS.EFFECTIF_DEPASSE, POIDS.EFFECTIF_DEPASSE_MAX)
      : 0
  }

  /**
   * Calcule la confiance basée sur le score (0-100)
   */
  private calculateConfidence(score: number): number {
    // Normalisation intelligente des scores en confiance (pourcentage direct)
    // Score 50+ = excellente confiance (80-100%)
    // Score 20-49 = bonne confiance (60-79%)
    // Score 0-19 = confiance moyenne (40-59%)
    // Score négatif = faible confiance (10-39%)

    if (score >= 50) {
      // Excellente confiance : 80-100%
      return Math.min(80 + (score - 50) * 0.4, 100)
    } else if (score >= 20) {
      // Bonne confiance : 60-79%
      return 60 + (score - 20) * 0.6
    } else if (score >= 0) {
      // Confiance moyenne : 40-59%
      return 40 + score * 1
    } else {
      // Faible confiance : 10-39%
      return Math.max(10, 40 + score * 0.3)
    }
  }

  /**
   * Parse la disponibilité JSON du bénévole
   */
  private parseAvailability(availability: string): any {
    try {
      return JSON.parse(availability)
    } catch {
      return {
        setup: true,
        event: true,
        teardown: true,
      }
    }
  }

  /**
   * Vérifie si un bénévole est disponible pour un créneau
   */
  private isVolunteerAvailable(
    volunteer: VolunteerApplication,
    slot: TimeSlot,
    availability: any
  ): boolean {
    // Une branche traitait ici des `unavailableSlots` — des indisponibilités ponctuelles que
    // l'appelant n'a jamais fournies, et que le site ne gérera pas : un bénévole les dira de vive
    // voix au responsable, qui retirera les créneaux s'il le juge nécessaire (décision du
    // 14/09/2026). Elle est retirée plutôt que laissée à suggérer une capacité qui n'existe pas.

    // Vérifier les disponibilités générales (montage, événement, démontage)
    const slotDate = dt.fromISO(slot.start)
    const slotType = this.getSlotType(slot, slotDate)

    switch (slotType) {
      case 'setup':
        return availability.setup === true
      case 'teardown':
        return availability.teardown === true
      case 'event':
      default:
        return availability.event === true
    }
  }

  /**
   * Détermine le type de créneau (montage, événement, démontage)
   */
  private getSlotType(slot: TimeSlot, slotDate: DateTime): 'setup' | 'event' | 'teardown' {
    // Les bornes de l'événement font foi : elles disent objectivement ce qui se passe avant
    // l'ouverture et après la fermeture, là où le titre du créneau ne disait que ce que son
    // auteur avait bien voulu y écrire. On compare des instants complets, pas des jours : un
    // créneau qui finit avant l'heure d'ouverture, le jour même, relève encore du montage.
    const debut = this.bornes.debut ? dt.fromISO(this.bornes.debut) : null
    const fin = this.bornes.fin ? dt.fromISO(this.bornes.fin) : null

    if (debut?.isValid && slotDate < debut) return 'setup'
    if (fin?.isValid && slotDate >= fin) return 'teardown'
    if (debut?.isValid || fin?.isValid) return 'event'

    // Repli quand l'édition n'a pas de dates : l'ancienne lecture du titre, faute de mieux.
    // « démontage » contient « montage » : le démontage doit donc être testé en premier, sans
    // quoi tout créneau de démontage est pris pour du montage — ce que faisait le code d'origine.
    const titre = slot.title.toLowerCase()
    if (titre.includes('démontage') || titre.includes('demontage') || titre.includes('teardown')) {
      return 'teardown'
    }
    if (titre.includes('montage') || titre.includes('setup')) return 'setup'
    return 'event'
  }

  /**
   * Calcule le bonus de préférence horaire pour un bénévole et un créneau
   */
  private calculateTimePreferenceBonus(
    volunteer: VolunteerApplication,
    slot: TimeSlot,
    availability: any
  ): number {
    return Math.round(POIDS.PLAGE_HORAIRE * this.recouvrementDesPreferences(slot, availability))
  }

  /**
   * Quelle PROPORTION du créneau tombe dans les plages horaires souhaitées, entre 0 et 1.
   *
   * Le calcul ne regardait que l'heure de DÉBUT : un créneau de 11 h à 19 h était classé « matin »,
   * et quelqu'un qui n'avait coché que « matin » le recevait en entier, huit heures comprises. En
   * mode strict, la même grossièreté écartait des créneaux qui chevauchaient largement la plage
   * demandée.
   *
   * Le bonus se cumulait par ailleurs sans plafond, 12 points par plage cochée : un créneau à
   * l'intersection de trois préférences valait plus qu'une disponibilité déclarée.
   *
   * Une proportion règle les deux : elle vaut 1 pour un créneau entièrement dans les plages
   * souhaitées, et ne dépasse jamais 1 même si plusieurs plages se chevauchent.
   */
  private recouvrementDesPreferences(slot: TimeSlot, availability: any): number {
    if (!Array.isArray(availability.timePreferences) || availability.timePreferences.length === 0) {
      return 0
    }

    const debut = this.local(slot.start)
    const fin = this.local(slot.end)
    const dureeMinutes = fin.diff(debut, 'minutes').minutes
    if (!Number.isFinite(dureeMinutes) || dureeMinutes <= 0) return 0

    // Les minutes du créneau, comptées depuis minuit du jour de son début : une plage qui franchit
    // minuit se prolonge donc naturellement au-delà de 1440 plutôt que de repartir à zéro.
    const debutMinutes = debut.hour * 60 + debut.minute
    const finMinutes = debutMinutes + dureeMinutes

    const couvertes = new Set<number>()

    for (const preference of availability.timePreferences) {
      const plage = PLAGES_HORAIRES[preference as keyof typeof PLAGES_HORAIRES]
      if (!plage) continue

      // Une plage qui franchit minuit (23 h → 2 h) se lit comme deux bornes croissantes, et on
      // l'essaie aussi décalée d'un jour pour attraper un créneau qui déborde sur le lendemain.
      const finPlage = plage.fin <= plage.debut ? plage.fin + 24 : plage.fin
      for (const decalage of [0, 24, -24]) {
        const a = Math.max(debutMinutes, (plage.debut + decalage) * 60)
        const b = Math.min(finMinutes, (finPlage + decalage) * 60)
        for (let minute = Math.ceil(a); minute < b; minute++) couvertes.add(minute)
      }
    }

    return Math.min(couvertes.size / dureeMinutes, 1)
  }

  /**
   * L'expérience ne se juge plus ici.
   *
   * Un bonus était accordé en cherchant « bénévole », « jonglerie » et « convention » dans le
   * texte libre de la candidature. Sur treize langues, un bénévole allemand décrivant dix ans de
   * pratique obtenait zéro ; et « jamais fait de jonglerie, jamais été bénévole » obtenait le
   * maximum, la négation n'étant pas détectée. Le champ est de surcroît sous le contrôle du
   * candidat.
   *
   * Plutôt que de le rebrancher sur une donnée structurée, la décision du 14/09/2026 est de le
   * RETIRER : l'expérience est un jugement humain — « je veux Alice à l'accueil, elle sait gérer
   * les gens » — et le responsable place qui il veut avant de lancer le calcul. Le mode « garder
   * les affectations manuelles » et la prise en compte de la charge existante rendent ce flux
   * naturel : ce qui est posé à la main reste, et le calcul complète.
   */

  /**
   * Obtient les heures actuelles assignées à un bénévole
   */
  private getCurrentVolunteerHours(volunteerId: number): number {
    // Un compteur tenu à jour, là où un balayage de toutes les affectations croisé avec tous les
    // créneaux était refait à chaque évaluation de score. Les heures déjà tenues hors de ce calcul
    // y sont comptées dès le constructeur.
    return this.heuresParBenevole.get(volunteerId) ?? 0
  }

  /**
   * Calcule la durée d'un créneau en heures
   */
  private getSlotDuration(slot: TimeSlot): number {
    const connue = this.dureeParCreneau.get(slot.id)
    if (connue !== undefined) return connue

    // Un créneau hors index — le cas ne devrait pas se présenter, mais le calculer coûte moins
    // cher que de rendre zéro et de fausser un plafond.
    return dt.fromISO(slot.end).diff(dt.fromISO(slot.start), 'hours').hours
  }

  /**
   * Calcule les heures d'un bénévole pour une date donnée
   */
  private getVolunteerHoursForDate(volunteerId: number, date: string): number {
    return this.heuresParJour.get(volunteerId)?.get(date) ?? 0
  }

  /**
   * Vérifie si l'ajout d'un créneau respecte les contraintes d'heures par jour
   */
  private checkDailyHoursConstraints(
    volunteerId: number,
    slot: TimeSlot,
    /** Compte les heures supplémentaires dans le plafond : la limite au-delà de la limite. */
    avecHeuresSup = false
  ): boolean {
    const slotDate = this.local(slot.start).toISODate()
    const currentDailyHours = this.getVolunteerHoursForDate(volunteerId, slotDate!)
    const slotDuration = this.getSlotDuration(slot)

    const maxHoursPerDay =
      (this.constraints.maxHoursPerDay || 8) +
      (avecHeuresSup ? this.constraints.maxOvertimeHours || 2 : 0)

    // Vérifie si l'ajout de ce créneau dépasserait la limite quotidienne
    return currentDailyHours + slotDuration <= maxHoursPerDay
  }

  /**
   * Calcule la moyenne d'heures par bénévole
   */
  private getAverageHours(): number {
    if (this.volunteers.length === 0) return 0

    // Un total maintenu au fil des affectations, là où la moyenne était recalculée en refaisant
    // le décompte complet de CHAQUE bénévole — à chaque évaluation de score.
    let total = this.totalHeuresPosees
    for (const affectation of this.affectationsExistantes) {
      const duree = dt.fromISO(affectation.end).diff(dt.fromISO(affectation.start), 'hours').hours
      if (Number.isFinite(duree)) total += duree
    }

    return total / this.volunteers.length
  }

  /**
   * Obtient les bénévoles disponibles
   */
  private getAvailableVolunteers(): VolunteerApplication[] {
    return this.volunteers.filter((volunteer) => volunteer.user.id)
  }

  /**
   * Trie les créneaux par priorité
   */
  private getSortedSlots(): TimeSlot[] {
    return [...this.timeSlots].sort((a, b) => {
      // Par nombre de places restantes (urgence)
      const remainingA = a.maxVolunteers - a.assignedVolunteers
      const remainingB = b.maxVolunteers - b.assignedVolunteers
      if (remainingA !== remainingB) return remainingA - remainingB

      // Enfin par date
      return dt.fromISO(a.start).toMillis() - dt.fromISO(b.start).toMillis()
    })
  }

  /**
   * Première passe : assignations évidentes
   */
  private assignHighPriorityMatches(volunteers: VolunteerApplication[], slots: TimeSlot[]): void {
    for (const slot of slots) {
      if (slot.assignedVolunteers >= slot.maxVolunteers) continue

      // Trouve les meilleurs candidats pour ce créneau
      const candidates = volunteers
        .map((volunteer) => ({
          volunteer,
          score: this.calculateAssignmentScore(volunteer, slot),
        }))
        .filter((candidate) => candidate.score > SEUILS.EVIDENCE)
        .sort((a, b) => b.score - a.score)

      // Assigne les meilleurs candidats
      const spotsToFill = slot.maxVolunteers - slot.assignedVolunteers
      let filled = 0

      for (const candidate of candidates) {
        if (filled >= spotsToFill) break

        // Vérifier les conflits temporels
        if (this.hasTimeConflict(candidate.volunteer.user.id, slot.id)) {
          continue // Passer au candidat suivant en cas de conflit
        }

        // Le créneau ne doit pas refermer le dernier passage d'un spectacle
        if (this.priveDuDernierPassage(candidate.volunteer.user.id, slot)) {
          continue
        }

        this.enregistrerAffectation({
          volunteerId: candidate.volunteer.user.id,
          slotId: slot.id,
          teamId: slot.teamId,
          score: candidate.score,
          confidence: this.calculateConfidence(candidate.score),
        })

        slot.assignedVolunteers++
        filled++
      }
    }
  }

  /**
   * Deuxième passe : remplissage des créneaux restants
   */
  private assignRemainingSlots(volunteers: VolunteerApplication[], slots: TimeSlot[]): void {
    for (const slot of slots) {
      if (slot.assignedVolunteers >= slot.maxVolunteers) continue

      // Trouve tous les candidats possibles
      const candidates = volunteers
        .filter((volunteer) => !this.isVolunteerAssignedToSlot(volunteer.user.id, slot.id))
        .map((volunteer) => ({
          volunteer,
          score: this.calculateAssignmentScore(volunteer, slot),
        }))
        .filter((candidate) => candidate.score > SEUILS.REMPLISSAGE)
        .sort((a, b) => b.score - a.score)

      // Assigne jusqu'à remplir le créneau
      const spotsToFill = slot.maxVolunteers - slot.assignedVolunteers
      let filled = 0

      for (const candidate of candidates) {
        if (filled >= spotsToFill) break

        // Vérifier les conflits temporels d'abord
        if (this.hasTimeConflict(candidate.volunteer.user.id, slot.id)) {
          continue // Passer au candidat suivant en cas de conflit
        }

        if (this.priveDuDernierPassage(candidate.volunteer.user.id, slot)) {
          continue
        }

        // Vérification finale des heures max
        const currentHours = this.getCurrentVolunteerHours(candidate.volunteer.user.id)
        const slotDuration = this.getSlotDuration(slot)
        const maxHours = this.constraints.maxHoursPerVolunteer || 12

        if (
          currentHours + slotDuration <=
          maxHours + (this.constraints.allowOvertime ? this.constraints.maxOvertimeHours || 2 : 0)
        ) {
          this.enregistrerAffectation({
            volunteerId: candidate.volunteer.user.id,
            slotId: slot.id,
            teamId: slot.teamId,
            score: candidate.score,
            confidence: this.calculateConfidence(candidate.score),
          })

          slot.assignedVolunteers++
          filled++
        }
      }
    }
  }

  /**
   * Vérifie si un bénévole est déjà assigné à un créneau
   */
  private isVolunteerAssignedToSlot(volunteerId: number, slotId: string): boolean {
    return this.assignments.some(
      (assignment) => assignment.volunteerId === volunteerId && assignment.slotId === slotId
    )
  }

  /**
   * Vérifie si un bénévole a un conflit temporel avec un créneau
   */
  private hasTimeConflict(volunteerId: number, slotId: string): boolean {
    const targetSlot = this.timeSlots.find((s) => s.id === slotId)
    if (!targetSlot) return false

    const targetStart = new Date(targetSlot.start)
    const targetEnd = new Date(targetSlot.end)

    /**
     * Les créneaux que ce bénévole tient déjà — ceux du calcul comme ceux qu'on lui a conservés,
     * tenus dans le même index. Auparavant, chaque appel refiltrait toutes les affectations et
     * cherchait chaque créneau linéairement.
     */
    const debut = targetStart.getTime()
    const fin = targetEnd.getTime()

    return (this.creneauxParBenevole.get(volunteerId) ?? []).some(
      (creneau) => creneau.slotId !== slotId && debut < creneau.fin && fin > creneau.debut
    )
  }

  /**
   * Ce créneau refermerait-il le dernier passage d'un spectacle pour ce bénévole ?
   *
   * La question ne se pose pas créneau par créneau : un créneau ne prive de rien tant qu'il
   * reste une représentation libre. Elle se pose donc contre les affectations déjà posées,
   * au moment de poser celle-ci.
   *
   * Un spectacle déjà hors d'atteinte avant ce créneau ne compte pas : l'affectation n'y
   * changerait plus rien, et le refuser bloquerait le bénévole sans rien lui rendre.
   */
  private priveDuDernierPassage(volunteerId: number, slot: TimeSlot): boolean {
    if (!this.constraints.preserverAccesSpectacles) return false
    if (this.representationsParSpectacle.length === 0) return false

    const bornesDe = (creneau: TimeSlot) => ({
      debut: new Date(creneau.start).getTime(),
      fin: new Date(creneau.end).getTime(),
    })

    const nouveau = bornesDe(slot)
    // Des bornes illisibles ne prouvent rien : mieux vaut laisser passer que refuser à tort.
    if (Number.isNaN(nouveau.debut) || Number.isNaN(nouveau.fin)) return false

    // Les créneaux tenus, déjà bornés dans l'index : ceux du calcul comme ceux qu'on a conservés.
    const dejaPris = (this.creneauxParBenevole.get(volunteerId) ?? []).filter(
      (creneau) => !Number.isNaN(creneau.debut) && !Number.isNaN(creneau.fin)
    )

    return this.representationsParSpectacle.some((representations) => {
      if (spectacleInaccessible(representations, dejaPris)) return false
      return spectacleInaccessible(representations, [...dejaPris, nouveau])
    })
  }

  /**
   * Troisième passe : équilibrage des assignations
   */
  /**
   * Rééquilibre les charges, en transférant des affectations des plus chargés vers les moins.
   *
   * Trois défauts corrigés ici, et le premier était le plus sournois :
   *
   * 1. Le transfert **réécrivait `volunteerId` sans recalculer `score` ni `confidence`** :
   *    l'affectation conservait les valeurs de l'ancien titulaire. La confiance affichée à
   *    l'organisateur était donc fausse pour toute affectation transférée, et elle contaminait
   *    la satisfaction moyenne.
   * 2. Les plafonds du receveur n'étaient pas revérifiés — seuls le chevauchement, l'accès aux
   *    spectacles et un score positif l'étaient. On pouvait donc le pousser au-delà de son
   *    maximum en croyant le soulager.
   * 3. Un seul transfert par bénévole sur-utilisé, listes calculées une fois : le rééquilibrage
   *    s'arrêtait avant d'avoir équilibré quoi que ce soit.
   *
   * Il itère désormais tant qu'un transfert améliore l'écart, borné pour ne pas tourner
   * indéfiniment sur un cas pathologique.
   */
  private balanceAssignments(): void {
    if (this.volunteers.length === 0) return

    for (let passe = 0; passe < LIMITES.PASSES_DE_REEQUILIBRAGE; passe++) {
      const charges = this.volunteers.map((volunteer) => ({
        id: volunteer.user.id,
        hours: this.getCurrentVolunteerHours(volunteer.user.id),
        volunteer,
      }))

      const moyenne = charges.reduce((somme, v) => somme + v.hours, 0) / charges.length
      const surCharges = charges
        .filter((v) => v.hours > moyenne + LIMITES.ECART_DE_CHARGE)
        .sort((a, b) => b.hours - a.hours)
      const sousCharges = charges
        .filter((v) => v.hours < moyenne - LIMITES.ECART_DE_CHARGE)
        .sort((a, b) => a.hours - b.hours)

      if (surCharges.length === 0 || sousCharges.length === 0) return

      let transfertEffectue = false

      for (const charge of surCharges) {
        for (const soulage of sousCharges) {
          // Transférer entre deux bénévoles de charge voisine ne rééquilibre rien et risque
          // d'osciller d'une passe à l'autre.
          if (charge.hours - soulage.hours < LIMITES.ECART_UTILE) continue

          const aTransferer = this.assignments.find(
            (assignment) =>
              assignment.volunteerId === charge.id &&
              this.canTransferAssignment(assignment, soulage.volunteer)
          )
          if (!aTransferer) continue

          const slot = this.creneauParId.get(aTransferer.slotId)
          if (!slot) continue

          // Le score est recalculé pour le receveur AVANT le transfert — c'est-à-dire dans
          // l'état où il ne tient pas encore ce créneau, comme pour n'importe quel candidat.
          const score = this.calculateAssignmentScore(soulage.volunteer, slot)

          this.retirerAffectation(aTransferer)
          aTransferer.volunteerId = soulage.id
          aTransferer.score = score
          aTransferer.confidence = this.calculateConfidence(score)

          const duree = this.getSlotDuration(slot)
          this.ajouterHeures(soulage.id, this.jourParCreneau.get(slot.id) ?? '', duree)
          this.ajouterCreneauTenu(soulage.id, {
            debut: new Date(slot.start).getTime(),
            fin: new Date(slot.end).getTime(),
            slotId: slot.id,
          })
          this.totalHeuresPosees += duree

          charge.hours -= duree
          soulage.hours += duree
          transfertEffectue = true
          break
        }
      }

      // Plus rien à déplacer : insister ne ferait que repasser sur les mêmes refus.
      if (!transfertEffectue) return
    }
  }

  /**
   * Vérifie si une assignation peut être transférée
   */
  private canTransferAssignment(
    assignment: Assignment,
    newVolunteer: VolunteerApplication
  ): boolean {
    const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
    if (!slot) return false

    // Vérifier les conflits temporels pour le nouveau bénévole
    if (this.hasTimeConflict(newVolunteer.user.id, assignment.slotId)) {
      return false
    }

    // Rééquilibrer ne doit pas priver celui qu'on soulage
    if (this.priveDuDernierPassage(newVolunteer.user.id, slot)) {
      return false
    }

    /**
     * Les plafonds du receveur, que le transfert ne vérifiait pas : on pouvait le pousser
     * au-delà de son maximum en croyant le soulager.
     */
    const duree = this.getSlotDuration(slot)
    const plafondTotal =
      (this.constraints.maxHoursPerVolunteer || 12) +
      (this.constraints.allowOvertime ? this.constraints.maxOvertimeHours || 2 : 0)

    if (this.getCurrentVolunteerHours(newVolunteer.user.id) + duree > plafondTotal) return false
    if (
      !this.checkDailyHoursConstraints(newVolunteer.user.id, slot, this.constraints.allowOvertime)
    )
      return false

    const score = this.calculateAssignmentScore(newVolunteer, slot)
    return score > 0 // Score positif minimum
  }

  /**
   * Génère les résultats finaux
   */
  private generateResults(): SchedulingResult {
    // Un bénévole déjà placé sur un créneau conservé n'est pas « non assigné » : le signaler
    // comme tel enverrait l'organisateur chercher un problème qui n'existe pas.
    const unassignedVolunteers = this.volunteers
      .filter(
        (volunteer) =>
          !this.assignments.some((a) => a.volunteerId === volunteer.user.id) &&
          !this.affectationsExistantes.some((a) => a.volunteerId === volunteer.user.id)
      )
      .map((v) => v.user.id)

    const unassignedSlots = this.timeSlots
      .filter((slot) => slot.assignedVolunteers < slot.maxVolunteers)
      .map((s) => s.id)

    const totalHours = this.assignments.reduce((total, assignment) => {
      const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
      return total + (slot ? this.getSlotDuration(slot) : 0)
    }, 0)

    const averageHours = this.volunteers.length > 0 ? totalHours / this.volunteers.length : 0

    const satisfactionRate =
      this.assignments.reduce(
        (total, assignment) => total + Math.max(assignment.confidence, 0),
        0
      ) /
      Math.max(this.assignments.length, 1) /
      100 // Convertir en ratio (0-1)

    const warnings: MessageResultat[] = []
    const recommendations: MessageResultat[] = []

    /**
     * Des codes, pas des phrases.
     *
     * Ces messages étaient écrits en français dans le moteur et affichés tels quels : sur une
     * application qui gère treize langues, ils restaient français pour tout le monde.
     */
    if (unassignedVolunteers.length > 0) {
      warnings.push({
        code: 'unassigned_volunteers',
        params: { count: unassignedVolunteers.length },
      })
    }
    if (unassignedSlots.length > 0) {
      warnings.push({ code: 'unassigned_slots', params: { count: unassignedSlots.length } })
    }
    if (satisfactionRate < 0.7) {
      recommendations.push({ code: 'adjust_constraints' })
    }
    if (averageHours < (this.constraints.minHoursPerVolunteer || 2)) {
      recommendations.push({ code: 'more_slots_or_fewer_volunteers' })
    }

    return {
      assignments: this.assignments,
      unassigned: {
        volunteers: unassignedVolunteers,
        slots: unassignedSlots,
      },
      stats: {
        totalAssignments: this.assignments.length,
        averageHoursPerVolunteer: averageHours,
        satisfactionRate,
        balanceScore: this.calculateBalanceScore(),
        ...this.mesurerLaQualite(),
      },
      warnings,
      recommendations,
      refus: this.diagnostiquerLesRefus(unassignedVolunteers, unassignedSlots),
    }
  }

  /**
   * Pourquoi les bénévoles restés sur le carreau y sont restés.
   *
   * N'examine que ce qui a échoué — les bénévoles non assignés et les créneaux non complétés :
   * expliquer une réussite n'apprendrait rien, et le coût d'un second balayage complet ne se
   * justifierait pas.
   *
   * ⚠️ Ce diagnostic est établi APRÈS coup, sur l'état final. Un bénévole peut donc y apparaître
   * comme « chevauchement » alors qu'il était libre au moment où le créneau a été distribué : ce
   * qu'on lui a donné entre-temps le bloque désormais. C'est bien ce qu'il faut dire à
   * l'organisateur — la question est « que relâcher pour lui trouver une place maintenant ».
   */
  private diagnostiquerLesRefus(
    benevolesNonAssignes: number[],
    creneauxNonCompletes: string[]
  ): SchedulingResult['refus'] {
    const creneauxVides = new Set(creneauxNonCompletes)
    const benevolesSansRien = new Set(benevolesNonAssignes)

    const parCreneau: SchedulingResult['refus']['parCreneau'] = []
    const comptesParCreneau = new Map<string, Map<MotifRefus, number>>()
    const comptesParBenevole = new Map<number, Map<MotifRefus, number>>()

    /**
     * Le relevé pris pendant les passes, plutôt qu'une réévaluation complète après coup.
     *
     * L'ancienne version rejouait `motifBloquant` pour chaque paire (bénévole, créneau vide) une
     * fois le calcul terminé : un second balayage presque aussi coûteux que le calcul, et qui
     * jugeait sur l'état FINAL — un bénévole libre au moment du refus pouvait y apparaître comme
     * « déjà pris », à cause de ce qu'on lui avait donné depuis.
     */
    for (const [paire, motif] of this.motifParPaire) {
      const separateur = paire.indexOf(':')
      const volunteerId = Number(paire.slice(0, separateur))
      const slotId = paire.slice(separateur + 1)

      if (creneauxVides.has(slotId)) {
        const comptes = comptesParCreneau.get(slotId) ?? new Map<MotifRefus, number>()
        comptes.set(motif, (comptes.get(motif) ?? 0) + 1)
        comptesParCreneau.set(slotId, comptes)
      }

      if (benevolesSansRien.has(volunteerId)) {
        const comptes = comptesParBenevole.get(volunteerId) ?? new Map<MotifRefus, number>()
        comptes.set(motif, (comptes.get(motif) ?? 0) + 1)
        comptesParBenevole.set(volunteerId, comptes)
      }
    }

    for (const [slotId, comptes] of comptesParCreneau) {
      parCreneau.push({
        slotId,
        motifs: [...comptes.entries()]
          .map(([motif, candidats]) => ({ motif, candidats }))
          .sort((a, b) => b.candidats - a.candidats),
      })
    }

    // Le motif dominant d'un bénévole : celui qui l'a écarté le plus souvent, donc le premier à
    // relâcher pour lui trouver une place.
    const parBenevole: SchedulingResult['refus']['parBenevole'] = []

    for (const volunteerId of benevolesNonAssignes) {
      const comptes = comptesParBenevole.get(volunteerId)
      // Aucune entrée : ce bénévole n'a été bloqué par aucune contrainte, il a seulement été
      // moins bien classé. Lui inventer un motif enverrait l'organisateur relâcher un réglage
      // qui n'y changerait rien.
      if (!comptes || comptes.size === 0) continue

      const [motif] = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]!
      parBenevole.push({ volunteerId, motif })
    }

    return { parBenevole, parCreneau }
  }

  /**
   * Ce que le planning vaut, mesuré sur des faits constatables.
   *
   * Chacun de ces chiffres se vérifie en regardant le planning : combien de bénévoles ont eu
   * l'équipe qu'ils demandaient, combien de créneaux sont pourvus. C'est ce qui les distingue de
   * la « satisfaction » qu'ils remplacent — elle était dérivée du score, donc de l'opinion que
   * l'algorithme avait de son propre travail.
   */
  private mesurerLaQualite() {
    const part = (numerateur: number, denominateur: number) =>
      denominateur > 0 ? numerateur / denominateur : 1

    const avecEquipe = this.assignments.filter((assignment) => assignment.teamId)
    const souhaitees = avecEquipe.filter((assignment) => {
      const volunteer = this.volunteers.find((v) => v.user.id === assignment.volunteerId)
      return volunteer?.teamPreferences?.some((pref) => pref === assignment.teamId)
    })

    const dansLesHoraires = this.assignments.filter((assignment) => {
      const slot = this.creneauParId.get(assignment.slotId)
      const volunteer = this.volunteers.find((v) => v.user.id === assignment.volunteerId)
      if (!slot || !volunteer) return false

      const availability = this.parseAvailability(volunteer.availability)
      if (!Array.isArray(availability.timePreferences) || availability.timePreferences.length === 0)
        return false

      return this.recouvrementDesPreferences(slot, availability) >= SEUILS.RECOUVREMENT_MINIMAL
    })

    // Seuls les bénévoles qui ont exprimé des préférences entrent dans ce ratio : compter ceux
    // qui n'ont rien demandé comme « mal servis » dirait le contraire de la vérité.
    const avecPreferencesHoraires = this.volunteers.filter((volunteer) => {
      const availability = this.parseAvailability(volunteer.availability)
      return Array.isArray(availability.timePreferences) && availability.timePreferences.length > 0
    })
    const affectationsDeCeuxLa = this.assignments.filter((assignment) =>
      avecPreferencesHoraires.some((v) => v.user.id === assignment.volunteerId)
    )

    const minimum = this.constraints.minHoursPerVolunteer || 2
    const auMinimum = this.volunteers.filter(
      (volunteer) => this.getCurrentVolunteerHours(volunteer.user.id) >= minimum
    )

    const complets = this.timeSlots.filter((slot) => slot.assignedVolunteers >= slot.maxVolunteers)

    const heures = this.volunteers.map((v) => this.getCurrentVolunteerHours(v.user.id))
    const moyenne = heures.reduce((somme, h) => somme + h, 0) / Math.max(heures.length, 1)
    const variance =
      heures.reduce((somme, h) => somme + (h - moyenne) ** 2, 0) / Math.max(heures.length, 1)

    return {
      preferencesEquipeHonorees: part(souhaitees.length, avecEquipe.length),
      creneauxDansLesHorairesSouhaites: part(dansLesHoraires.length, affectationsDeCeuxLa.length),
      benevolesAuMinimumDHeures: part(auMinimum.length, this.volunteers.length),
      creneauxComplets: part(complets.length, this.timeSlots.length),
      ecartTypeDesHeures: Math.sqrt(variance),
    }
  }

  /**
   * Calcule un score d'équilibrage (0-1)
   */
  private calculateBalanceScore(): number {
    const volunteerHours = this.volunteers.map((volunteer) =>
      this.getCurrentVolunteerHours(volunteer.user.id)
    )

    if (volunteerHours.length === 0) return 1

    const avgHours = volunteerHours.reduce((sum, hours) => sum + hours, 0) / volunteerHours.length
    const variance =
      volunteerHours.reduce((sum, hours) => sum + Math.pow(hours - avgHours, 2), 0) /
      volunteerHours.length
    const stdDev = Math.sqrt(variance)

    // Score inversement proportionnel à l'écart-type
    return Math.max(0, 1 - stdDev / (avgHours + 1))
  }
}
