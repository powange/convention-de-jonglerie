/**
 * Le choix des colonnes d'un tableau, porté par l'URL.
 *
 * Sept écrans proposent de masquer des colonnes ; un seul le retenait, et seulement pour lui.
 * Recharger la page, ou envoyer le lien à quelqu'un, ramenait le tableau tel qu'il arrive —
 * c'est-à-dire en défaisant ce qu'on venait de régler.
 *
 * Fonctions pures, à part du composable : ce sont ces deux règles qui peuvent se tromper, et les
 * vérifier ici évite de monter un routeur.
 */

/** Le nom du paramètre, le même partout : qui apprend une URL les connaît toutes. */
export const PARAMETRE_DE_COLONNES = 'colonnes'

/**
 * La valeur qui dit « aucune colonne masquée », quand le silence ne suffit pas.
 *
 * Trois tableaux en masquent par défaut — la description d'un tarif, son statut. Sur ceux-là,
 * « tout afficher » est un CHOIX, et l'absence de paramètre signifie déjà « les défauts ». Sans ce
 * mot réservé, révéler une colonne cachée par défaut ne pourrait pas s'écrire, et le réglage
 * disparaîtrait au premier rechargement.
 */
export const AUCUNE_COLONNE_MASQUEE = 'aucune'

/** Les identifiants masqués d'un état de visibilité, triés. */
function masquees(visibilite: Record<string, boolean>): string[] {
  return Object.entries(visibilite)
    .filter(([, visible]) => visible === false)
    .map(([id]) => id)
    .sort()
}

/**
 * Ce que l'URL doit porter : l'ÉCART au défaut, jamais l'état absolu.
 *
 * Les colonnes masquées et non les visibles — sur un tableau sans défaut, toutes le sont au
 * départ, et énumérer les visibles allongerait chaque URL sans rien dire de plus. Triées, pour
 * qu'un même réglage donne toujours le même lien : deux personnes ayant fait le même choix doivent
 * pouvoir comparer leurs adresses.
 *
 * Rend `null` quand l'état est celui d'arrivée : l'appelant retire alors le paramètre plutôt que
 * d'écrire une valeur vide, qui se lirait comme un choix.
 */
export function colonnesMasqueesVersUrl(
  visibilite: Record<string, boolean>,
  defauts: Record<string, boolean> = {}
): string | null {
  const actuelles = masquees(visibilite)
  const initiales = masquees(defauts)

  if (actuelles.join(',') === initiales.join(',')) return null
  return actuelles.length ? actuelles.join(',') : AUCUNE_COLONNE_MASQUEE
}

/**
 * L'état de visibilité que décrit l'URL.
 *
 * `masquables` borne ce que le paramètre peut cacher : sans cette liste, une adresse mal recopiée
 * ferait disparaître la colonne d'actions ou celle du statut, que l'écran ne propose justement pas
 * de masquer. Une colonne inconnue est ignorée plutôt que rendue — mieux vaut une colonne de trop
 * qu'un tableau amputé.
 *
 * Sans paramètre, les défauts de l'écran : l'absence n'est pas « tout afficher », c'est
 * « je n'ai rien réglé ».
 */
export function colonnesMasqueesDepuisUrl(
  valeur: unknown,
  masquables: readonly string[],
  defauts: Record<string, boolean> = {}
): Record<string, boolean> {
  if (typeof valeur !== 'string' || !valeur) return { ...defauts }
  if (valeur === AUCUNE_COLONNE_MASQUEE) return {}

  const autorisees = new Set(masquables)
  const visibilite: Record<string, boolean> = {}
  for (const id of valeur.split(',')) {
    if (autorisees.has(id)) visibilite[id] = false
  }
  return visibilite
}

/**
 * Les colonnes qu'un tableau laisse masquer, d'après sa définition.
 *
 * L'identifiant d'une colonne TanStack est son `id` quand il est écrit, et son `accessorKey`
 * sinon — la bibliothèque le dérive. Ne lire que `id` laissait de côté la plupart des colonnes
 * du dépôt, qui n'en déclarent pas : les masquer n'aurait jamais été retenu dans l'URL, sans que
 * rien ne le signale.
 *
 * Écrit ici plutôt que recopié dans chaque écran : sept tableaux poseraient sept fois la même
 * question, et la première réponse fausse s'y serait propagée.
 */
export function colonnesMasquablesDe(
  colonnes: readonly { id?: string; accessorKey?: string; enableHiding?: boolean }[]
): string[] {
  return colonnes
    .filter((colonne) => colonne.enableHiding !== false)
    .map((colonne) => colonne.id ?? colonne.accessorKey)
    .filter((id): id is string => Boolean(id))
}
