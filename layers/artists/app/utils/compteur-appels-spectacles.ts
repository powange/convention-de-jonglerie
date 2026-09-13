/**
 * Ce que les appels à spectacles signalent au menu latéral.
 *
 * Une seule chose attend une décision d'organisateur et n'en donne aucun signe tant qu'on n'ouvre
 * pas l'écran : les candidatures en attente. Ce sont des artistes qui patientent, et le silence
 * coûte cher — quelqu'un qui ne reçoit pas de réponse ne repostule pas l'année suivante.
 *
 * Le compte porte sur TOUS les appels de l'édition, additionnés. Une édition en ouvre souvent
 * plusieurs — un par scène, ou un par soirée — et regarder chacun pour savoir s'il reste quelque
 * chose à trancher est précisément le travail que la pastille supprime.
 *
 * Les candidatures ACCEPTÉES ou REFUSÉES ne comptent pas, et c'est délibéré : elles allumeraient la
 * pastille en permanence dès la première décision prise, et elle cesserait alors de vouloir dire
 * quelque chose. La règle est la même que pour les candidatures de bénévoles et les emprunts de
 * matériel, où seul ce qui reste à faire s'affiche.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Un appel à spectacles, réduit à ce que la pastille en lit. */
export interface AppelAvecStatistiques {
  stats?: { pending?: number | null } | null
}

/** La réponse de `/api/editions/:id/shows-call`, réduite de même. */
export interface ReponseDesAppels {
  showCalls?: AppelAvecStatistiques[] | null
}

/**
 * Le nombre de candidatures en attente, tous appels confondus.
 *
 * `null` et non zéro quand la réponse est inexploitable : `null` veut dire « on ne sait pas » et
 * n'affiche aucune pastille, tandis que zéro affirmerait qu'il n'y a rien à traiter — une
 * information qu'une réponse malformée ne permet pas de donner.
 *
 * Une édition sans aucun appel rend zéro, en revanche : là, l'absence de candidature en attente
 * est une réponse, pas une ignorance.
 */
export function compterCandidaturesDeSpectaclesEnAttente(
  reponse: ReponseDesAppels | null | undefined
): number | null {
  const appels = reponse?.showCalls
  if (!Array.isArray(appels)) return null

  return appels.reduce((total, appel) => {
    const enAttente = appel?.stats?.pending
    // Un appel dont les statistiques manquent vaut zéro plutôt que d'annuler tout le compte : un
    // seul appel mal formé ne doit pas effacer une pastille que les autres justifient.
    return total + (typeof enAttente === 'number' ? enAttente : 0)
  }, 0)
}
