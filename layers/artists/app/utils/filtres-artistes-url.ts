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

/** Les filtres, tels que la page les manipule. */
export interface FiltresDArtistes {
  /**
   * Identifiants des spectacles retenus. Vide signifie « tous » : une liste vide EST l'absence
   * de filtre, ce qui évite d'avoir à réserver une valeur sentinelle pour le dire.
   */
  spectacles: string[]
  /** La recherche libre. */
  recherche: string
}

/**
 * Les identifiants portés par `?show=`, séparés par des virgules.
 *
 * Le séparateur suit `queryList` de `useQueryFilters`, déjà employé ailleurs dans le dépôt :
 * une seule façon d'écrire une liste dans une URL vaut mieux que deux.
 *
 * Une ancienne URL à un seul spectacle — `?show=3` — se relit sans rien de particulier, ce qui
 * évite de casser les liens déjà partagés.
 */
function listeDepuis(valeur: unknown): string[] {
  if (Array.isArray(valeur)) {
    // Vue Router rend un tableau quand la clé apparaît plusieurs fois (`?show=3&show=7`). On
    // l'accepte plutôt que de le laisser tomber en silence.
    return valeur.flatMap((element) => listeDepuis(element))
  }
  if (typeof valeur !== 'string') return []
  return valeur
    .split(',')
    .map((element) => element.trim())
    .filter(Boolean)
}

/** Les filtres que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas. */
export function filtresDepuisUrl(query: Record<string, unknown>): FiltresDArtistes {
  return {
    spectacles: listeDepuis(query.show),
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

  if (filtres.spectacles.length > 0) {
    query.show = filtres.spectacles.join(',')
  }
  // La recherche est recopiée telle quelle, espaces compris : c'est ce que la personne a tapé, et
  // la rogner ferait diverger l'URL de ce que montre le champ.
  if (filtres.recherche) query.search = filtres.recherche

  return query
}
