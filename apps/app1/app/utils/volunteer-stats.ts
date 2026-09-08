/**
 * Utilitaires pour le calcul des statistiques des b�n�voles
 */

export interface VolunteerStats {
  totalVolunteers: number
  /** Organisateurs tenant au moins un créneau. Distingués des bénévoles, mais comptés comme eux. */
  totalOrganizers: number
  totalHours: number
  averageHours: number
  totalSlots: number
}

export interface VolunteerStat {
  user: {
    id: number
    pseudo: string
    prenom?: string | null
    nom?: string | null
    [key: string]: any
  }
  /** Vrai pour un organisateur : l'affichage le signale, sans le sortir du relevé. */
  estOrganisateur?: boolean
  hours: number
  slots: number
}

export interface DayStats {
  /** Organisateurs présents ce jour-là. Comptés à part des bénévoles, pas fondus. */
  totalOrganizers: number
  date: string
  volunteers: VolunteerStat[]
  totalVolunteers: number
  totalHours: number
}

export interface VolunteerStatsIndividual {
  user: {
    id: number
    pseudo: string
    prenom?: string | null
    nom?: string | null
    [key: string]: any
  }
  /**
   * Vrai pour un organisateur tenant des créneaux sans candidature de bénévole. Absent pour un
   * bénévole accepté, y compris s'il est par ailleurs organisateur de l'édition : c'est bien sa
   * candidature qui le fait figurer ici.
   */
  estOrganisateur?: boolean
  totalHours: number
  totalSlots: number
  dayDetails?: Array<{
    date: string
    hours: number
    slots: number
  }>
}

export interface TimeSlotWithAssignments {
  id: string | number
  start: string
  end: string
  assignedVolunteersList?: Array<{
    user: {
      id: number
      pseudo: string
      prenom?: string | null
      nom?: string | null
      [key: string]: any
    }
    [key: string]: any
  }>
  /** Organisateurs affectés au créneau. Ils y tiennent un poste comme les bénévoles. */
  assignedOrganizersList?: Array<{
    user: {
      id: number
      pseudo: string
      prenom?: string | null
      nom?: string | null
      [key: string]: any
    }
    [key: string]: any
  }>
  [key: string]: any
}

/**
 * Tout le monde sur un créneau : bénévoles affectés et organisateurs rattachés.
 *
 * Les statistiques mesurent le travail réellement tenu, et un organisateur qui tient un poste
 * le tient autant qu'un bénévole. C'est cohérent avec la capacité d'un créneau, où il occupe
 * une place comme les autres.
 */
export function personnesDuCreneau(slot: TimeSlotWithAssignments): Array<{
  user: { id: number; pseudo: string; prenom?: string | null; nom?: string | null }
  estOrganisateur: boolean
}> {
  return [
    ...(slot.assignedVolunteersList ?? []).map((affectation) => ({
      user: affectation.user,
      estOrganisateur: false,
    })),
    ...(slot.assignedOrganizersList ?? []).map((affectation) => ({
      user: affectation.user,
      estOrganisateur: true,
    })),
  ]
}

export interface AcceptedVolunteer {
  user: {
    id: number
    pseudo: string
    prenom?: string | null
    nom?: string | null
    [key: string]: any
  }
  status: string
  [key: string]: any
}

/**
 * Calcule les statistiques globales des b�n�voles
 */
export function calculateVolunteersStats(
  timeSlots: TimeSlotWithAssignments[],
  acceptedVolunteers: AcceptedVolunteer[]
): VolunteerStats {
  const totalVolunteers = acceptedVolunteers.length || 0

  let totalHours = 0
  let totalSlots = 0
  // Un organisateur ne compte que s'il tient un créneau : rattaché à une équipe sans poste, il
  // n'a rien à peser dans un relevé d'heures.
  const organisateursAvecCreneau = new Set<number>()

  timeSlots.forEach((slot) => {
    const personnes = personnesDuCreneau(slot)
    if (personnes.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

    personnes.forEach((personne) => {
      if (personne.estOrganisateur) organisateursAvecCreneau.add(personne.user.id)
      totalHours += hours
      totalSlots += 1
    })
  })

  const totalOrganizers = organisateursAvecCreneau.size
  // La moyenne se rapporte à tous ceux qui tiennent un poste : diviser les heures des uns par
  // le seul effectif des autres donnerait une moyenne gonflée.
  const effectif = totalVolunteers + totalOrganizers
  const averageHours = effectif > 0 ? totalHours / effectif : 0

  return {
    totalVolunteers,
    totalOrganizers,
    totalHours,
    averageHours,
    totalSlots,
  }
}

/**
 * Calcule les statistiques par jour
 */
export function calculateVolunteersStatsByDay(timeSlots: TimeSlotWithAssignments[]): DayStats[] {
  const dayStats = new Map<string, any>()

  timeSlots.forEach((slot) => {
    // Organisateurs compris : un jour de convention se mesure à qui l'a tenu, pas au titre
    // sous lequel chacun l'a fait.
    const personnes = personnesDuCreneau(slot)
    if (personnes.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const dayKey = startTime.toISOString().split('T')[0] ?? '' // YYYY-MM-DD

    // Un seul chemin plutôt que has/set/get : la valeur manquante est créée sur place, et
    // l'on ne relit plus une entrée dont rien ne garantissait la présence.
    const day = dayStats.get(dayKey) ?? {
      date: dayKey,
      volunteers: new Map<number, any>(),
      totalHours: 0,
      totalVolunteers: 0,
      totalOrganizers: 0,
    }
    dayStats.set(dayKey, day)

    personnes.forEach((personne) => {
      const userId = personne.user.id

      if (!day.volunteers.has(userId)) {
        day.volunteers.set(userId, {
          user: personne.user,
          estOrganisateur: personne.estOrganisateur,
          hours: 0,
          slots: 0,
        })
      }

      const volunteerStat = day.volunteers.get(userId)
      volunteerStat.hours += hours
      volunteerStat.slots += 1
      day.totalHours += hours
    })

    // Les deux titres se comptent séparément : « 8 bénévoles et 2 organisateurs » dit qui
    // tient la journée, là où « 10 personnes » le tairait.
    const parTitre = [...day.volunteers.values()]
    day.totalVolunteers = parTitre.filter((personne) => !personne.estOrganisateur).length
    day.totalOrganizers = parTitre.filter((personne) => personne.estOrganisateur).length
  })

  // Convertir en array et trier par date
  return Array.from(dayStats.values())
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      volunteers: Array.from(day.volunteers.values()).sort((a: any, b: any) => b.hours - a.hours), // Trier par heures d�croissantes
    }))
}

/**
 * Calcule les statistiques par b�n�vole individuel (incluant ceux sans cr�neaux)
 */
export function calculateVolunteersStatsIndividual(
  timeSlots: TimeSlotWithAssignments[],
  acceptedVolunteers: AcceptedVolunteer[]
): VolunteerStatsIndividual[] {
  const volunteerStats = new Map<number, any>()

  // D'abord, ajouter tous les b�n�voles accept�s avec 0 heures
  acceptedVolunteers.forEach((application) => {
    if (application.user && !volunteerStats.has(application.user.id)) {
      volunteerStats.set(application.user.id, {
        user: application.user,
        totalHours: 0,
        totalSlots: 0,
        dayDetails: new Map<string, any>(),
      })
    }
  })

  // Ensuite, calculer les heures pour ceux qui ont des cr�neaux
  timeSlots.forEach((slot) => {
    const personnes = personnesDuCreneau(slot)
    if (personnes.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const dayKey = startTime.toISOString().split('T')[0] // YYYY-MM-DD

    personnes.forEach((personne) => {
      const userId = personne.user.id

      // Un organisateur n'a pas de candidature : il n'est pas dans la liste de départ, et
      // c'est ici qu'il entre — le relevé serait muet sur les heures qu'il tient.
      if (!volunteerStats.has(userId)) {
        volunteerStats.set(userId, {
          user: personne.user,
          estOrganisateur: personne.estOrganisateur,
          totalHours: 0,
          totalSlots: 0,
          dayDetails: new Map<string, any>(),
        })
      }

      const volunteerStat = volunteerStats.get(userId)
      volunteerStat.totalHours += hours
      volunteerStat.totalSlots += 1

      // Ajouter les d�tails par jour
      if (!volunteerStat.dayDetails.has(dayKey)) {
        volunteerStat.dayDetails.set(dayKey, {
          date: dayKey,
          hours: 0,
          slots: 0,
        })
      }

      const dayDetail = volunteerStat.dayDetails.get(dayKey)
      dayDetail.hours += hours
      dayDetail.slots += 1
    })
  })

  // Convertir en array et trier par nombre d'heures total d�croissant
  return Array.from(volunteerStats.values())
    .map((volunteer) => ({
      ...volunteer,
      dayDetails: Array.from(volunteer.dayDetails.values()).sort((a: any, b: any) =>
        a.date.localeCompare(b.date)
      ), // Trier par date
    }))
    .sort((a, b) => {
      // Trier par heures d�croissantes, puis par nom
      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours
      }
      return (a.user.pseudo || '').localeCompare(b.user.pseudo || '')
    })
}

export interface TeamStats {
  teamId: string | null
  teamName: string
  color?: string
  /** Les heures **à pourvoir** : durée du créneau × nombre de places demandées. */
  totalHours: number
  /** Les heures **réellement tenues** : durée du créneau × personnes affectées dessus. */
  coveredHours: number
  totalSlots: number
  totalVolunteers: number
  /** Organisateurs tenant un créneau de l'équipe. Comptés à part des bénévoles, pas fondus. */
  totalOrganizers: number
  /** Chaque jour porte les mêmes mesures que l'équipe entière. */
  dayDetails: Array<{
    date: string
    hours: number
    coveredHours: number
    volunteers: number
    organizers: number
    slots: number
  }>
}

/**
 * Heures par équipe, au total et jour par jour.
 *
 * Les heures comptées sont celles **à couvrir** : la durée d'un créneau multipliée par le
 * nombre de bénévoles qu'il demande (`maxVolunteers`), et non par le nombre de personnes déjà
 * affectées. Un créneau de deux heures demandant trois bénévoles pèse donc six heures dès sa
 * création, avant toute affectation — c'est la charge à pourvoir qui permet de dimensionner
 * une équipe, et elle ne doit pas grandir au fil des affectations.
 *
 * Les créneaux sans personne affectée comptent donc pleinement, et ceux sans équipe sont
 * regroupés à part plutôt qu'ignorés : les passer sous silence ferait mentir le total.
 *
 * `totalVolunteers` et `totalOrganizers` disent, eux, qui est réellement affecté — où en est
 * le remplissage face à cette charge, et sous quel titre.
 *
 * @param timeSlots - Créneaux de l'édition
 * @param teams - Équipes de l'édition, pour nommer et colorer les lignes
 */
export function calculateVolunteersStatsByTeam(
  timeSlots: TimeSlotWithAssignments[],
  teams: Array<{ id: string; name: string; color?: string }> = [],
  libelleSansEquipe = 'Sans équipe'
): TeamStats[] {
  const parEquipe = new Map<string, any>()
  const nomDe = new Map(teams.map((equipe) => [equipe.id, equipe]))

  timeSlots.forEach((slot) => {
    // Organisateurs compris : « qui tient cette équipe » se lit sur les personnes présentes,
    // quel que soit leur titre.
    const affectes = personnesDuCreneau(slot)

    const debut = new Date(slot.start)
    const fin = new Date(slot.end)
    const dureeCreneau = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60)
    if (!Number.isFinite(dureeCreneau) || dureeCreneau <= 0) return

    const jour = debut.toISOString().split('T')[0] as string
    const cle = (slot.teamId as string | null) ?? '__sans_equipe__'

    if (!parEquipe.has(cle)) {
      const equipe = slot.teamId ? nomDe.get(slot.teamId as string) : undefined
      parEquipe.set(cle, {
        teamId: (slot.teamId as string | null) ?? null,
        teamName: equipe?.name ?? (slot.teamName as string | undefined) ?? libelleSansEquipe,
        color: equipe?.color,
        totalHours: 0,
        coveredHours: 0,
        totalSlots: 0,
        benevoles: new Set<number>(),
        organisateurs: new Set<number>(),
        jours: new Map<string, any>(),
      })
    }

    const equipe = parEquipe.get(cle)
    // Le besoin du créneau, pas son remplissage. `maxVolunteers` vaut 1 par défaut en base ;
    // le repli protège d'un créneau mal formé plutôt que de compter zéro heure.
    const besoin = Math.max(1, Number(slot.maxVolunteers) || 1)
    const heuresBenevole = dureeCreneau * besoin

    equipe.totalHours += heuresBenevole
    // Ce qui est effectivement tenu, en regard de ce qu'il y a à tenir : une équipe à 4h sur
    // 31h se voit tout de suite, là où le seul besoin ne disait pas où elle en était.
    equipe.coveredHours += dureeCreneau * affectes.length
    equipe.totalSlots += 1
    affectes.forEach((personne) => {
      // Deux ensembles distincts : « 3 bénévoles et 1 organisateur » se lit mieux que « 4
      // personnes », et dit qui l'on peut encore solliciter.
      const ou = personne.estOrganisateur ? equipe.organisateurs : equipe.benevoles
      ou.add(personne.user.id)
    })

    if (!equipe.jours.has(jour)) {
      // Les personnes sont comptées par jour dans leurs propres ensembles : quelqu'un présent
      // sur deux créneaux du même jour ne doit compter qu'une fois pour ce jour-là.
      equipe.jours.set(jour, {
        date: jour,
        hours: 0,
        coveredHours: 0,
        benevoles: new Set<number>(),
        organisateurs: new Set<number>(),
        slots: 0,
      })
    }
    const detailDuJour = equipe.jours.get(jour)!
    detailDuJour.hours += heuresBenevole
    detailDuJour.coveredHours += dureeCreneau * affectes.length
    detailDuJour.slots += 1
    affectes.forEach((personne) => {
      const ou = personne.estOrganisateur ? detailDuJour.organisateurs : detailDuJour.benevoles
      ou.add(personne.user.id)
    })
  })

  return Array.from(parEquipe.values())
    .map((equipe) => ({
      teamId: equipe.teamId,
      teamName: equipe.teamName,
      color: equipe.color,
      totalHours: equipe.totalHours,
      coveredHours: equipe.coveredHours,
      totalSlots: equipe.totalSlots,
      totalVolunteers: equipe.benevoles.size,
      totalOrganizers: equipe.organisateurs.size,
      dayDetails: Array.from(equipe.jours.values())
        .map((jour: any) => ({
          date: jour.date,
          hours: jour.hours,
          coveredHours: jour.coveredHours,
          volunteers: jour.benevoles.size,
          organizers: jour.organisateurs.size,
          slots: jour.slots,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.totalHours - a.totalHours)
}
