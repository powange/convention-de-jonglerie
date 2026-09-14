/**
 * Qui proposer pour tenir un créneau, et sous quel titre.
 *
 * La modale d'affectation ne montrait que les membres de l'équipe du créneau. La règle se
 * défendait — proposer toute l'édition faisait perdre son sens à l'équipe —, mais elle rendait
 * impossible le geste même pour lequel les bénévoles volants existent : venir en renfort d'une
 * équipe à laquelle on n'appartient pas.
 *
 * D'où deux listes plutôt qu'une. Les MEMBRES de l'équipe restent la réponse ordinaire ; les
 * RENFORTS sont proposés en plus, à part, pour qu'on voie qu'on fait appel à quelqu'un
 * d'extérieur — appeler un volant n'est pas le geste anodin de remplir une case.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Ce qu'il faut connaître d'un bénévole pour décider s'il est affectable. */
export interface BenevoleAffectable {
  userId: number
  /** Les identifiants de ses équipes. */
  assignedTeams?: string[] | null
  /** Vrai quand TOUTES ses équipes sont volantes — voir `benevoles-volants`. */
  estVolant?: boolean | null
}

/** Les deux listes que la modale affiche. */
export interface PropositionsDAffectation<T> {
  /** Les membres de l'équipe du créneau, ou tout le monde si le créneau n'a pas d'équipe. */
  membres: T[]
  /**
   * Les volants, proposés en renfort sur n'importe quel créneau.
   *
   * Vide quand le créneau n'a pas d'équipe : là, tout le monde est déjà proposé, et distinguer
   * un « renfort » n'aurait aucun sens — il n'y a pas d'équipe à renforcer.
   */
  renforts: T[]
}

/**
 * Les personnes à proposer pour ce créneau, réparties en deux groupes.
 *
 * @param candidats tous les bénévoles acceptés de l'édition
 * @param affectes  ceux déjà posés sur ce créneau, à retirer des deux listes
 * @param teamId    équipe du créneau ; `null`, `undefined` ou `'unassigned'` = créneau sans
 *                  équipe, qui propose alors tout le monde comme membres
 */
export function benevolesAffectables<T extends BenevoleAffectable>(
  candidats: readonly T[],
  affectes: readonly { user: { id: number } }[],
  teamId: string | null | undefined
): PropositionsDAffectation<T> {
  const equipe = teamId === 'unassigned' ? null : (teamId ?? null)
  const dejaPoses = new Set(affectes.map((affectation) => affectation.user.id))

  const restants = candidats.filter((candidat) => !dejaPoses.has(candidat.userId))

  // Sans équipe, la distinction n'a pas lieu d'être : on propose tout le monde d'un bloc.
  if (!equipe) return { membres: restants, renforts: [] }

  const membres: T[] = []
  const renforts: T[] = []

  for (const candidat of restants) {
    const sesEquipes = Array.isArray(candidat.assignedTeams) ? candidat.assignedTeams : []
    if (sesEquipes.includes(equipe)) {
      // L'appartenance prime sur le statut : un volant rattaché à cette équipe-là n'est pas un
      // renfort venu d'ailleurs, il est chez lui.
      membres.push(candidat)
    } else if (candidat.estVolant === true) {
      renforts.push(candidat)
    }
  }

  return { membres, renforts }
}
