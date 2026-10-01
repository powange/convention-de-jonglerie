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

/** La provenance d'arrivée de l'écran : aucun filtre. */
export const SOURCE_PAR_DEFAUT = 'ALL'

/**
 * Les colonnes sur lesquelles ce tableau sait classer.
 *
 * ⚠️ CETTE LISTE RECOPIE `COLONNES` de `server/utils/tri-candidatures.ts`, et il faut qu'elle
 * reste d'accord avec elle. Ce fichier ne doit rien importer — il est chargé hors Nuxt par les
 * tests unitaires, et le fichier serveur importe un type de Prisma. Un test compare donc les deux
 * listes : elles ne peuvent plus diverger en silence.
 *
 * Pourquoi cette exigence : la liste est paginée PAR LE SERVEUR. Un champ que lui ignore ferait
 * revenir les candidatures dans l'ordre par défaut, sous un en-tête de colonne pourtant fléché —
 * un classement faux mais plausible, le pire des cas.
 */
export const COLONNES_TRIABLES = [
  'pseudo',
  'prenom',
  'nom',
  'allergies',
  'status',
  'createdAt',
  'arrivalDateTime',
  'departureDateTime',
] as const

/** Le classement d'arrivée : les candidatures les plus récentes d'abord. */
export const TRI_PAR_DEFAUT = { champ: 'createdAt', descendant: true } as const

/** Les filtres, tels que le tableau les manipule. */
export interface FiltresDeCandidatures {
  statut: string
  /** D'où vient la candidature : `ALL`, `APPLICATION` (spontanée) ou `MANUAL` (ajout). */
  source: string
  equipesSouhaitees: string[]
  presence: string[]
  /** Statut du billet au contrôle d'accès : `validated`, `not_validated`, `no_ticket`. */
  billet: string[]
  equipesAssignees: string[]
  recherche: string
}

/**
 * La page de pagination portée par l'URL.
 *
 * Elle accompagne les filtres plutôt que de les laisser seuls : revenir sur un lien filtré mais
 * ramené à la première page ne règle que la moitié du problème quand la liste en compte dix.
 */
export function pageDepuisUrl(brut: unknown): number {
  if (typeof brut !== 'string' || !brut) return 1
  const valeur = Number(brut)
  return Number.isInteger(valeur) && valeur > 0 ? valeur : 1
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
    source: typeof query.source === 'string' && query.source ? query.source : SOURCE_PAR_DEFAUT,
    equipesSouhaitees: listeDepuisUrl(query.teams),
    presence: listeDepuisUrl(query.presence),
    billet: listeDepuisUrl(query.ticket),
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
  filtres: FiltresDeCandidatures,
  page = 1
): Record<string, string> {
  // On reconstruit plutôt que de supprimer clé à clé : un `delete` sur une clé calculée est
  // refusé par le linter, et l'omission dit la même chose sans détour.
  const {
    status: _s,
    source: _so,
    teams: _t,
    presence: _p,
    ticket: _b,
    assignedTeams: _a,
    search: _r,
    page: _pg,
    ...autres
  } = queryActuelle as Record<string, string>
  const query = { ...autres } as Record<string, string>

  const poser = (cle: string, valeur: string) => {
    if (valeur) query[cle] = valeur
  }

  poser('status', filtres.statut === STATUT_PAR_DEFAUT ? '' : filtres.statut)
  poser('source', filtres.source === SOURCE_PAR_DEFAUT ? '' : filtres.source)
  poser('teams', filtres.equipesSouhaitees.join(','))
  poser('presence', filtres.presence.join(','))
  poser('ticket', filtres.billet.join(','))
  poser('assignedTeams', filtres.equipesAssignees.join(','))
  // La recherche est recopiée telle quelle, espaces compris : c'est ce que la personne a tapé,
  // et le serveur s'en charge déjà. La rogner ici ferait diverger l'URL de ce que montre le champ.
  poser('search', filtres.recherche)
  // La première page est l'état d'arrivée : l'écrire allongerait l'URL sans rien dire.
  poser('page', page > 1 ? String(page) : '')

  return query
}
