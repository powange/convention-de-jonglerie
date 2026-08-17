/**
 * Correspondances entre un élément de programme et les modules qui savent en faire davantage.
 *
 * Un élément se saisit en quelques secondes ; un spectacle porte des artistes et des besoins
 * techniques, un workshop un nombre de places. Convertir évite de ressaisir — mais les trois
 * modèles ne disent pas la même chose des mêmes moments, et cette asymétrie est concentrée ici.
 */

/**
 * Durée en minutes, telle que l'attend un spectacle.
 *
 * Les spectacles stockent une durée plutôt qu'une heure de fin. Sans fin, on rend `null` : un
 * spectacle sans durée est permis, alors qu'une durée inventée s'afficherait comme un fait.
 */
export function dureeEnMinutes(debut: string | Date, fin?: string | Date | null): number | null {
  if (!fin) return null
  const d = new Date(debut).getTime()
  const f = new Date(fin).getTime()
  if (!Number.isFinite(d) || !Number.isFinite(f)) return null
  const minutes = Math.round((f - d) / 60_000)
  // Une durée nulle ou négative viendrait d'un créneau incohérent : mieux vaut pas de durée du
  // tout qu'un nombre qui ferait dire n'importe quoi à l'affichage.
  return minutes > 0 ? minutes : null
}

/** Ce qu'une conversion vers un workshop exige et que l'élément ne garantit pas. */
export interface ManquesConversion {
  /**
   * Conservé à `false` : un workshop accepte désormais de n'avoir pas d'heure de fin, comme
   * l'élément dont il est issu. Le champ reste là pour ne pas casser les appelants, et parce
   * qu'un autre écart pourrait le raviver.
   */
  finRequise: boolean
  /** Un workshop n'a pas d'état de publication : il paraît dès sa création. */
  publicationImmediate: boolean
}

/**
 * Ce qu'il faut signaler avant de convertir en workshop.
 *
 * Rendu séparément de la conversion elle-même pour que l'écran puisse prévenir *avant* d'agir :
 * une fois le workshop créé, il est public, et l'élément d'origine supprimé.
 */
export function manquesPourWorkshop(element: {
  endDateTime?: string | Date | null
  isPublic?: boolean
}): ManquesConversion {
  return {
    finRequise: false,
    publicationImmediate: element.isPublic === false,
  }
}
