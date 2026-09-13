/**
 * Ce que les listes de courses signalent au menu latéral.
 *
 * Une seule chose y attend encore un geste : une liste dont tous les articles ne sont pas cochés.
 * C'est du matériel qu'on s'est promis de racheter et qui ne se rappellera pas à nous autrement —
 * on ne s'en aperçoit qu'à l'édition suivante, en ouvrant la caisse.
 *
 * Une liste TERMINÉE ne compte pas, et c'est délibéré : elle allumerait la pastille à jamais, et
 * celle-ci cesserait alors de vouloir dire quelque chose. Même règle que les candidatures de
 * spectacles et les emprunts de matériel, où seul ce qui reste à faire s'affiche.
 *
 * Une liste VIDE ne compte pas non plus, bien qu'elle ne soit pas « terminée » au sens de
 * `listeTerminee` : elle ne promet aucun achat, donc elle n'attend rien de personne. C'est la
 * seule divergence entre les deux notions, et elle est voulue.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Une liste de courses, réduite à ce que la pastille en lit. */
export interface ListePourCompteur {
  items?: Array<{ purchased?: boolean | null }> | null
}

/** La réponse de `/api/editions/:id/stock-shopping-lists`, réduite de même. */
export interface ReponseDesListes {
  data?: { lists?: ListePourCompteur[] | null } | null
}

/**
 * Cette liste attend-elle encore des achats&nbsp;?
 *
 * Exportée parce que la page s'en sert aussi, sur les listes qu'elle a déjà chargées : la pastille
 * du menu et le chiffre affiché en tête de page doivent dire la même chose, et deux règles
 * séparées finiraient par diverger.
 */
export function listeEnCours(liste: ListePourCompteur | null | undefined): boolean {
  const articles = liste?.items
  if (!Array.isArray(articles) || articles.length === 0) return false
  return articles.some((article) => article?.purchased !== true)
}

/**
 * Le nombre de listes de courses qu'il reste à finir.
 *
 * `null` et non zéro quand la réponse est inexploitable : `null` veut dire « on ne sait pas » et
 * n'affiche aucune pastille, tandis que zéro affirmerait qu'il n'y a plus rien à acheter — une
 * information qu'une réponse malformée ne permet pas de donner.
 *
 * Une édition sans aucune liste rend zéro, en revanche : là, l'absence est une réponse.
 */
export function compterListesDeCoursesEnCours(
  reponse: ReponseDesListes | null | undefined
): number | null {
  const listes = reponse?.data?.lists
  if (!Array.isArray(listes)) return null

  return listes.filter(listeEnCours).length
}
