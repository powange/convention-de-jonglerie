// Types importés non utilisés supprimés

/**
 * Retourne le nom à afficher pour une édition.
 * Si l'édition n'a pas de nom, retourne le nom de la convention.
 *
 * ⚠️ LA RÈGLE VIT DANS `shared/utils/nom-edition.ts` — constat B5. Elle existait en trois
 * versions : celle-ci, une copie en ligne dans la tâche des échéances, et une TROISIÈME qui
 * composait `edition.title`, champ qui n'existe pas, et envoyait « Convention X - undefined » en
 * notification. Ce fichier garde sa signature — ses appelants n'ont pas à changer — mais il ne
 * décide plus.
 *
 * 📍 La chaîne VIDE est conservée en dernier recours pour cet appelant-là : un nom affiché dans
 * l'interface peut être vide sans conséquence, là où une notification qui annonce « Édition »
 * sans rien d'autre n'aiderait personne. C'est pourquoi la règle partagée prend un `id`.
 */
export function getEditionDisplayName(edition: {
  name?: string | null
  convention?: { name: string }
}): string {
  return edition.name || edition.convention?.name || ''
}

/**
 * Retourne le nom à afficher pour une édition avec convention séparée.
 */
export function getEditionDisplayNameWithConvention(
  edition: { name?: string | null },
  convention: { name: string }
): string {
  return edition.name || convention?.name || ''
}
