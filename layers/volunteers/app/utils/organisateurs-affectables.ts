/**
 * Qui peut être affecté à un créneau, parmi les organisateurs de l'édition.
 *
 * Même règle que pour les bénévoles dans la modale d'affectation : un créneau porté par une
 * équipe ne propose que les gens rattachés à cette équipe. Proposer toute l'organisation donnait
 * une liste où l'équipe du créneau ne voulait plus rien dire.
 *
 * Fonction pure et non filtre écrit dans le composant : c'est la règle qui mérite d'être
 * vérifiée, et la vérifier ici évite de monter une modale et ses quatre appels réseau.
 */

/** Ce qu'il faut connaître d'un organisateur pour décider s'il est affectable. */
export interface OrganisateurAffectable {
  editionOrganizerId: number
  teamIds: string[]
}

/**
 * @param candidats  organisateurs de l'édition, avec leurs équipes
 * @param affectes   ceux déjà posés sur ce créneau, à retirer de la liste
 * @param teamId     équipe du créneau ; `null`, `undefined` ou `'unassigned'` = créneau sans
 *                   équipe, qui propose alors tout le monde — comme côté bénévoles
 */
export function organisateursAffectables<T extends OrganisateurAffectable>(
  candidats: T[],
  affectes: Array<{ editionOrganizerId: number }>,
  teamId: string | null | undefined
): T[] {
  const equipe = teamId === 'unassigned' ? null : (teamId ?? null)
  const dejaPoses = new Set(affectes.map((affectation) => affectation.editionOrganizerId))

  return candidats.filter((candidat) => {
    if (dejaPoses.has(candidat.editionOrganizerId)) return false
    if (!equipe) return true
    return candidat.teamIds.includes(equipe)
  })
}
