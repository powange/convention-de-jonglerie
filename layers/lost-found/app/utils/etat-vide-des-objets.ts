/**
 * Lequel des deux vides regarde-t-on — constat F3.
 *
 * ⚠️⚠️ LES OBJETS RESTITUÉS SONT MASQUÉS PAR DÉFAUT. Une édition dont **tout** a été rendu
 * présente donc exactement la même liste vide qu'une édition où **rien** n'a été signalé. L'écran
 * annonçait « Aucun objet n'a été signalé pour cette édition » dans les deux cas — alors que dans
 * le premier, la liste est pleine et le bouton pour la montrer est juste au-dessus.
 *
 * La trace de l'intention était dans le code : le message vide était un ternaire dont les **deux
 * branches rendaient la même clé**. Quelqu'un avait voulu distinguer les deux cas et ne l'avait
 * pas fait.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le statut d'un objet rendu à son propriétaire, tel que le schéma le nomme. */
export const STATUT_RESTITUE = 'RETURNED'

/** Les trois réponses possibles, et `aucun` veut dire « il y a quelque chose à afficher ». */
export type EtatVideDesObjets = 'aucun' | 'rien-signale' | 'tout-restitue'

/**
 * @param objets les objets signalés pour l'édition, restitués compris
 * @param afficheRestitues le filtre est-il levé ?
 */
export const etatVideDesObjets = (
  objets: readonly { status?: string | null }[],
  afficheRestitues: boolean
): EtatVideDesObjets => {
  const visibles = afficheRestitues
    ? objets
    : objets.filter((objet) => objet.status !== STATUT_RESTITUE)

  if (visibles.length > 0) return 'aucun'

  /*
   * `some` plutôt que `objets.length > 0`, parce que c'est le prédicat JUSTE : on n'annonce une
   * restitution que si l'on en a vu une.
   *
   * ⚠️⚠️ MAIS IL NE PROTÈGE DE RIEN AUJOURD'HUI, et le prétendre serait faux. Un sabotage l'a
   * montré : remplacé par `objets.length > 0`, les douze cas restent VERTS. C'est arithmétique —
   * le seul filtre est celui des restitués, donc arriver ici avec `objets` non vide implique que
   * tous le sont. Les deux écritures sont équivalentes tant que ce filtre est le seul.
   *
   * Ce `some` n'est donc qu'une avance sur un second filtre, qui le rendrait alors nécessaire.
   * Aucun cas ne peut l'éprouver avant ce jour-là : écrire une garde qu'on ne peut pas exercer et
   * la présenter comme une protection est précisément ce que ce commentaire évite.
   */
  return objets.some((objet) => objet.status === STATUT_RESTITUE) ? 'tout-restitue' : 'rien-signale'
}
