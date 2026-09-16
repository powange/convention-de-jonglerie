/**
 * Lecture et écriture des filtres d'artistes dans l'URL.
 *
 * Sans ça, un rechargement — ou un lien envoyé à un collègue — repartait de « tous les
 * spectacles, aucune recherche », alors que c'est précisément la sélection filtrée qu'on voulait
 * retrouver ou montrer. Le planning et les candidatures de bénévoles appliquent déjà cette règle ;
 * celle-ci en suit la forme, pour que les trois écrans ne divergent pas.
 *
 * Seules les valeurs qui s'écartent du défaut figurent dans l'URL : la garder courte, c'est la
 * garder lisible et copiable.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** L'état d'arrivée du filtre de spectacle : aucun filtre. */
export const SPECTACLE_PAR_DEFAUT = 'ALL'

/** Les filtres, tels que la page les manipule. */
export interface FiltresDArtistes {
  /** Identifiant du spectacle retenu, ou `ALL`. */
  spectacle: string
  /** La recherche libre. */
  recherche: string
}

/** Les filtres que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas. */
export function filtresDepuisUrl(query: Record<string, unknown>): FiltresDArtistes {
  return {
    spectacle: typeof query.show === 'string' && query.show ? query.show : SPECTACLE_PAR_DEFAUT,
    recherche: typeof query.search === 'string' ? query.search : '',
  }
}

/**
 * La query reflétant les filtres, en préservant les autres paramètres déjà présents.
 *
 * Les paramètres étrangers sont conservés plutôt qu'écrasés : la page peut en porter d'autres,
 * qu'un changement de filtre n'a aucune raison d'effacer.
 */
export function requeteArtistes(
  queryActuelle: Record<string, unknown>,
  filtres: FiltresDArtistes
): Record<string, string> {
  // On reconstruit sans les clés que l'on gère, plutôt que de les supprimer : un `delete` sur une
  // clé calculée est refusé par le linter, et l'omission dit la même chose sans détour.
  const { show: _show, search: _search, ...autres } = queryActuelle as Record<string, string>
  const query = { ...autres } as Record<string, string>

  if (filtres.spectacle && filtres.spectacle !== SPECTACLE_PAR_DEFAUT) {
    query.show = filtres.spectacle
  }
  // La recherche est recopiée telle quelle, espaces compris : c'est ce que la personne a tapé, et
  // la rogner ferait diverger l'URL de ce que montre le champ.
  if (filtres.recherche) query.search = filtres.recherche

  return query
}
