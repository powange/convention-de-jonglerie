/**
 * Ce que l'écran des candidatures demande à l'API : ses filtres, son tri, sa pagination.
 *
 * La composition vivait deux fois dans le même composant — une fois pour rafraîchir la liste, une
 * fois pour l'exporter — mot pour mot identique. Les deux copies n'avaient pas encore divergé, et
 * c'est tout l'intérêt de les réunir maintenant : le jour où un filtre s'ajoute à la liste sans
 * être reporté sur l'export, l'export livre silencieusement autre chose que ce qu'on a sous les
 * yeux. Personne ne s'en aperçoit — un fichier de candidatures ne se relit pas ligne à ligne.
 *
 * Le même composant venait de perdre son tri secondaire pour une raison jumelle : une règle écrite
 * deux fois dont une seule était juste.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Une colonne triée, telle que le tableau en tient l'état. */
export interface ColonneTriee {
  id: string
  desc?: boolean
}

/** Les filtres, tels que les contrôles de l'écran les portent. */
export interface FiltresCandidatures {
  /** Le statut retenu. `ALL`, vide ou absent valent « tous ». */
  statut?: string | null
  equipesSouhaitees?: string[]
  presence?: string[]
  equipesAssignees?: string[]
  recherche?: string | null
}

/** Le tri, réduit aux trois paramètres que l'API attend. */
export interface ParametresDeTri {
  sortField: string
  sortDir: 'asc' | 'desc'
  /** `champ:sens` séparés par des virgules, ou rien s'il n'y a pas de départage. */
  sortSecondary?: string
}

/** La colonne retenue quand le tableau n'en a désigné aucune. */
export const COLONNE_PAR_DEFAUT = 'createdAt'

/**
 * Le tri envoyé à l'API.
 *
 * La première colonne commande, les suivantes départagent. Une liste vide retombe sur la date de
 * candidature, croissante — il faut bien classer selon quelque chose, et c'est ce que le tableau
 * faisait déjà.
 */
export function parametresDeTri(colonnes: ColonneTriee[]): ParametresDeTri {
  const [principale, ...departages] = colonnes

  return {
    sortField: principale?.id || COLONNE_PAR_DEFAUT,
    sortDir: principale?.desc ? 'desc' : 'asc',
    // `undefined` et non la chaîne vide : un paramètre absent ne part pas dans la requête, là où
    // une chaîne vide y figurerait et demanderait au serveur de l'ignorer.
    sortSecondary:
      departages.map((c) => `${c.id}:${c.desc ? 'desc' : 'asc'}`).join(',') || undefined,
  }
}

/**
 * Les filtres envoyés à l'API.
 *
 * Chaque filtre inactif rend `undefined` plutôt qu'une valeur vide : c'est ce qui le fait
 * disparaître de la requête. Une liste vide envoyée comme chaîne vide se lirait « filtre sur rien »
 * et ne rendrait aucune candidature.
 */
export function parametresDeFiltre(
  filtres: FiltresCandidatures
): Record<string, string | undefined> {
  const liste = (valeurs?: string[]) =>
    valeurs && valeurs.length > 0 ? valeurs.join(',') : undefined

  return {
    // `ALL` est la valeur que porte le contrôle quand il ne filtre rien : la transmettre telle
    // quelle chercherait un statut de ce nom.
    status: filtres.statut && filtres.statut !== 'ALL' ? filtres.statut : undefined,
    teams: liste(filtres.equipesSouhaitees),
    presence: liste(filtres.presence),
    assignedTeams: liste(filtres.equipesAssignees),
    search: filtres.recherche || undefined,
  }
}

/** Ce qui distingue les deux usages, et rien d'autre. */
export type UsageCandidatures =
  | { usage: 'liste'; page: number; pageSize: number }
  | { usage: 'export' }

/**
 * La requête complète, pour la liste comme pour l'export.
 *
 * Les deux partagent exactement leurs filtres et leur tri — c'est la promesse du module, et la
 * raison pour laquelle un seul appel les compose. Ce qui les sépare tient en trois clés : la liste
 * pagine et veut les équipes, l'export se déclare et prend tout.
 */
export function parametresDesCandidatures(
  filtres: FiltresCandidatures,
  colonnes: ColonneTriee[],
  usage: UsageCandidatures
): Record<string, string | number | undefined> {
  const commun = { ...parametresDeFiltre(filtres), ...parametresDeTri(colonnes) }

  if (usage.usage === 'export') {
    return { ...commun, export: 'true' }
  }

  return { ...commun, page: usage.page, pageSize: usage.pageSize, includeTeams: 'true' }
}

/**
 * La même requête en chaîne d'URL, pour l'export qui construit son lien à la main.
 *
 * Les paramètres absents sont retirés ici plutôt que laissés à `URLSearchParams`, qui écrirait
 * `status=undefined` — une valeur que le serveur prendrait pour un statut.
 */
export function chaineDeRequete(parametres: Record<string, string | number | undefined>): string {
  const retenus = Object.entries(parametres)
    .filter(([, valeur]) => valeur !== undefined && valeur !== '')
    .map(([cle, valeur]) => [cle, String(valeur)] as [string, string])

  return new URLSearchParams(retenus).toString()
}
