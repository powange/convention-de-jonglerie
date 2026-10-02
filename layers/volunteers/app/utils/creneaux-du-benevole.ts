/**
 * Les créneaux d'une personne, et ce qui les sépare.
 *
 * Le relevé par bénévole donne un total d'heures ; il ne dit jamais comment elles s'enchaînent.
 * Une pause de vingt minutes entre deux postes, ou une journée coupée en trois morceaux, ne se
 * voient nulle part dans un total.
 *
 * Le calcul vit ici plutôt que dans l'écran : les cas limites — chevauchement, enchaînement
 * direct, créneaux mal ordonnés — se trompent silencieusement, et un écran authentifié ne se
 * vérifie pas d'un coup d'œil.
 */

/** Un créneau tel que la page le porte, réduit à ce qui nous intéresse. */
export interface CreneauAffecte {
  id: string | number
  startDateTime: string
  endDateTime: string
  [key: string]: any
}

/** Un créneau de la liste, avec ce qui le sépare du précédent. */
export interface CreneauAvecIntervalle<T> {
  creneau: T
  /**
   * Minutes séparant la fin du créneau précédent du début de celui-ci.
   *
   * `null` pour le premier créneau, qui ne suit rien. Négatif en cas de chevauchement : la
   * personne est attendue à deux endroits en même temps, et c'est une anomalie à voir.
   */
  intervalleMinutes: number | null
}

/**
 * Les personnes affectées à un créneau, bénévoles et organisateurs confondus.
 *
 * ⚠️ DEUX NOMS POUR LA MÊME CHOSE, ET C'EST LÀ QUE LE DÉFAUT VIVAIT.
 * `/api/editions/:id/volunteer-time-slots` rend `assignments` et `organizerAssignments` ; le
 * planning de gestion les RECOPIE ensuite sous `assignedVolunteersList` et
 * `assignedOrganizersList` avant de les passer à ses composants. Cette fonction ne connaissait que
 * les seconds — donc sur la page publique des bénévoles, qui passe la réponse de l'API telle
 * quelle, la modale « créneaux du bénévole » n'affichait **jamais rien, pour personne**, sans
 * erreur ni trace. Un responsable d'équipe cliquait sur un membre et voyait « aucun créneau »
 * alors qu'il en avait.
 *
 * On lit donc les deux formes. Le choix de les CUMULER plutôt que d'en préférer une : un écran
 * peut mêler les deux — la liste de l'API et un créneau qu'il a lui-même recomposé —, et un
 * identifiant vu deux fois ne change rien, puisque ce qui compte est l'appartenance.
 */
function personnesDuCreneau(creneau: CreneauAffecte): number[] {
  const affectations = [
    ...(creneau.assignedVolunteersList ?? []),
    ...(creneau.assignedOrganizersList ?? []),
    ...(creneau.assignments ?? []),
    ...(creneau.organizerAssignments ?? []),
  ]
  const ids = affectations
    .map((affectation: any) => affectation?.user?.id)
    .filter((id) => id != null)
  return [...new Set(ids)]
}

/**
 * Les créneaux d'une personne, du plus tôt au plus tard, chacun accompagné du temps qui le sépare
 * du précédent.
 *
 * L'ordre est imposé ici et non supposé : la liste vient du planning, où rien ne garantit qu'un
 * créneau ajouté après coup se range à sa place. Sans ce tri, les intervalles seraient calculés
 * entre des créneaux qui ne se suivent pas.
 *
 * Le temps est compté en minutes, y compris d'un jour sur l'autre : une nuit est un repos comme
 * un autre, simplement plus long.
 */
export function creneauxDuBenevole<T extends CreneauAffecte>(
  creneaux: T[],
  userId: number
): Array<CreneauAvecIntervalle<T>> {
  const siens = creneaux
    .filter((creneau) => personnesDuCreneau(creneau).includes(userId))
    .filter((creneau) => Number.isFinite(new Date(creneau.startDateTime).getTime()))
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())

  return siens.map((creneau, rang) => {
    if (rang === 0) return { creneau, intervalleMinutes: null }

    const finPrecedente = new Date(siens[rang - 1]!.endDateTime).getTime()
    const debut = new Date(creneau.startDateTime).getTime()
    if (!Number.isFinite(finPrecedente)) return { creneau, intervalleMinutes: null }

    return { creneau, intervalleMinutes: Math.round((debut - finPrecedente) / 60000) }
  })
}
