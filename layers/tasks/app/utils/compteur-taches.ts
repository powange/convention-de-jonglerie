/**
 * Ce que les tâches signalent au menu latéral.
 *
 * Une seule chose y mérite une pastille : une tâche dont l'échéance est passée et que personne n'a
 * close. C'est le seul état qui appelle un geste — préparer une convention, c'est surtout ne rien
 * laisser filer.
 *
 * Le calcul se fait en base, parce qu'il dépend de l'heure courante et porte sur des tâches que le
 * menu n'a aucune raison de charger. Ce fichier ne fait donc que lire la réponse, mais il le fait
 * ici plutôt que dans le plugin : la distinction entre « zéro » et « on ne sait pas » est une
 * règle, et une règle se teste.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La réponse de `/api/editions/:id/tasks/overdue-count`, réduite à ce que la pastille en lit. */
export interface ReponseDesTachesEnRetard {
  data?: { overdue?: number | null } | null
}

/**
 * Le nombre de tâches en retard, ou `null` quand on ne sait pas.
 *
 * `null` et non zéro sur une réponse inexploitable : `null` n'affiche aucune pastille, tandis que
 * zéro affirmerait que rien n'est en retard — une information qu'une réponse malformée ne permet
 * pas de donner. Une édition sans aucun retard rend bien zéro, en revanche : là, l'absence est une
 * réponse.
 *
 * Un nombre négatif ou fractionnaire est traité comme inexploitable : il ne vient pas de ce point
 * d'API, donc on ne sait pas ce qu'on lit.
 */
export function compterTachesEnRetard(
  reponse: ReponseDesTachesEnRetard | null | undefined
): number | null {
  const enRetard = reponse?.data?.overdue
  if (typeof enRetard !== 'number' || !Number.isInteger(enRetard) || enRetard < 0) return null

  return enRetard
}
