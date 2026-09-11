/**
 * Ce que le bénévolat signale au menu latéral.
 *
 * Deux choses attendent une décision d'organisateur et n'en donnent aucun signe tant qu'on n'ouvre
 * pas l'écran : les candidatures en attente, et les échanges de créneaux que les deux bénévoles ont
 * acceptés et qu'il reste à trancher. Les deux sont des gens qui patientent, et le silence coûte
 * plus cher qu'ailleurs — un candidat sans réponse ne repostule pas l'année suivante.
 *
 * Ces deux comptes seulement, et c'est délibéré. Le nombre total de candidatures, ou celui des
 * échanges en cours, allumerait la pastille en permanence dès la première inscription ; elle
 * cesserait alors de vouloir dire quelque chose. La règle est la même que pour les emprunts de
 * matériel, où seul le retard compte.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La pagination que rend l'API des candidatures, réduite à ce qui nous intéresse. */
export interface ReponsePaginee {
  pagination?: { totalCount?: number | null } | null
}

/**
 * Le nombre de candidatures en attente, lu dans la pagination.
 *
 * L'API est interrogée avec `status=PENDING` et la plus petite page possible : seul le total
 * compte, et rapatrier les candidatures pour les compter serait absurde pour une pastille.
 *
 * Un total absent rend `null` et non zéro : `null` veut dire « on ne sait pas », et n'affiche
 * aucune pastille&nbsp;; zéro affirmerait qu'il n'y a rien en attente, ce qui est une information
 * qu'une réponse malformée ne permet pas de donner.
 */
export function compterCandidaturesEnAttente(
  reponse: ReponsePaginee | null | undefined
): number | null {
  const total = reponse?.pagination?.totalCount

  return typeof total === 'number' ? total : null
}

/** Une demande d'échange, réduite à son état. */
export interface DemandeDEchange {
  status?: string | null
}

/**
 * Le nombre d'échanges qui attendent un organisateur.
 *
 * `PENDING_MANAGER` et lui seul : une demande encore en attente de la réponse du bénévole visé
 * n'appelle aucune action de l'organisateur, et la compter lui ferait ouvrir l'écran pour rien.
 *
 * Le filtrage est refait ici bien que l'endpoint soit censé ne rendre que celles-là : c'est la
 * pastille qui décide de ce qu'elle annonce, et elle ne doit pas se mettre à compter autre chose
 * le jour où cet endpoint élargit ce qu'il renvoie.
 */
export function compterEchangesATrancher(demandes: DemandeDEchange[] | null | undefined): number {
  return (demandes ?? []).filter((demande) => demande?.status === 'PENDING_MANAGER').length
}
