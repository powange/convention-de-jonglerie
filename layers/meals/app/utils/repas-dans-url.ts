/**
 * Le repas sélectionné, conservé dans l'URL de l'écran de validation.
 *
 * Sans ça, un rechargement — ou un lien envoyé à qui tient la porte — repartait sur le repas
 * « en cours ou à venir » calculé depuis l'heure, et non sur celui qu'on regardait. Pendant un
 * service, c'est la différence entre reprendre où l'on en était et devoir re-sélectionner.
 *
 * ⚠️ Contrairement aux filtres du planning ou des candidatures, le repas est écrit dans l'URL
 * MÊME quand il correspond au choix par défaut. Ce défaut-là n'est pas un état stable : il dépend
 * de l'heure qu'il est, et le taire rendrait le lien ambigu une heure plus tard.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** L'identifiant de repas porté par l'URL, ou `null` s'il n'y en a pas d'exploitable. */
export function repasDepuisUrl(brut: unknown): number | null {
  if (typeof brut !== 'string' && typeof brut !== 'number') return null
  const identifiant = Number(brut)
  return Number.isInteger(identifiant) && identifiant > 0 ? identifiant : null
}

/**
 * Le repas de l'URL, s'il existe encore sur cette édition.
 *
 * Rend `null` quand l'URL cite un repas supprimé, ou celui d'une autre édition. C'est ce `null`
 * qui laisse la sélection automatique reprendre la main : sans ce contrôle, l'écran restait vide
 * sur un lien devenu caduc, sans rien expliquer — le même piège que les équipes du planning.
 *
 * Tant que les repas ne sont pas chargés, la sélection est gardée telle quelle : l'écarter ici
 * perdrait le choix de l'URL avant même de pouvoir le valider.
 */
export function repasConnu(
  selection: number | null,
  repas: ReadonlyArray<{ id: number }>
): number | null {
  if (selection === null) return null
  if (repas.length === 0) return selection
  return repas.some((unRepas) => unRepas.id === selection) ? selection : null
}

/** La query reflétant le repas retenu, en préservant les autres paramètres déjà présents. */
export function requeteRepas(
  queryActuelle: Record<string, unknown>,
  selection: number | null
): Record<string, string> {
  const { meal: _meal, ...autres } = queryActuelle as Record<string, string>
  const query = { ...autres } as Record<string, string>

  if (selection !== null) query.meal = String(selection)

  return query
}
