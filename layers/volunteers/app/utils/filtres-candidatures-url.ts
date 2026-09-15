/**
 * Lecture et écriture des filtres de candidatures dans l'URL.
 *
 * Sans ça, un rechargement — ou un lien envoyé à un collègue — repartait de « tous les statuts,
 * toutes les équipes », alors que c'est précisément la sélection filtrée qu'on voulait retrouver
 * ou montrer. Le planning appliquait déjà cette règle à ses propres filtres ; celle-ci en suit la
 * forme à la lettre, pour que les deux écrans ne divergent pas.
 *
 * Seules les valeurs qui s'écartent du défaut figurent dans l'URL : la garder courte, c'est la
 * garder lisible et copiable.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le statut d'arrivée de l'écran : aucun filtre. */
export const STATUT_PAR_DEFAUT = 'ALL'

/** Les filtres, tels que le tableau les manipule. */
export interface FiltresDeCandidatures {
  statut: string
  equipesSouhaitees: string[]
  presence: string[]
  equipesAssignees: string[]
  recherche: string
}

/** Une liste d'identifiants portée par l'URL, séparée par des virgules. */
function listeDepuisUrl(brut: unknown): string[] {
  if (typeof brut !== 'string' || !brut) return []
  return brut.split(',').filter(Boolean)
}

/** Les filtres que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas. */
export function filtresDepuisUrl(query: Record<string, unknown>): FiltresDeCandidatures {
  return {
    statut: typeof query.status === 'string' && query.status ? query.status : STATUT_PAR_DEFAUT,
    equipesSouhaitees: listeDepuisUrl(query.teams),
    presence: listeDepuisUrl(query.presence),
    equipesAssignees: listeDepuisUrl(query.assignedTeams),
    recherche: typeof query.search === 'string' ? query.search : '',
  }
}

/**
 * La query reflétant les filtres, en préservant les autres paramètres déjà présents.
 *
 * Les paramètres étrangers sont conservés plutôt qu'écrasés : la page porte aussi l'onglet actif
 * et d'autres réglages, qu'un filtre d'équipe n'a aucune raison d'effacer.
 */
export function requeteCandidatures(
  queryActuelle: Record<string, unknown>,
  filtres: FiltresDeCandidatures
): Record<string, string> {
  // On reconstruit plutôt que de supprimer clé à clé : un `delete` sur une clé calculée est
  // refusé par le linter, et l'omission dit la même chose sans détour.
  const {
    status: _s,
    teams: _t,
    presence: _p,
    assignedTeams: _a,
    search: _r,
    ...autres
  } = queryActuelle as Record<string, string>
  const query = { ...autres } as Record<string, string>

  const poser = (cle: string, valeur: string) => {
    if (valeur) query[cle] = valeur
  }

  poser('status', filtres.statut === STATUT_PAR_DEFAUT ? '' : filtres.statut)
  poser('teams', filtres.equipesSouhaitees.join(','))
  poser('presence', filtres.presence.join(','))
  poser('assignedTeams', filtres.equipesAssignees.join(','))
  // La recherche est recopiée telle quelle, espaces compris : c'est ce que la personne a tapé,
  // et le serveur s'en charge déjà. La rogner ici ferait diverger l'URL de ce que montre le champ.
  poser('search', filtres.recherche)

  return query
}
