/**
 * Lecture et écriture des filtres du planning dans l'URL.
 *
 * Sans ça, un rechargement — ou un lien envoyé à quelqu'un d'autre — repartait de « toutes les
 * équipes », alors que c'est précisément la vue filtrée qu'on voulait montrer.
 *
 * Comme ailleurs dans le dépôt (journal d'erreurs, administration des comptes) : seules les
 * valeurs qui s'écartent du défaut figurent dans l'URL.
 *
 * Fonctions pures et non lecture directe de la route dans le composant : ce sont ces règles-là
 * qui peuvent se tromper, et les vérifier ici évite de monter un routeur.
 */

export const GRANULARITE_PAR_DEFAUT = 30
export const GRANULARITES_ADMISES = [15, 30, 60] as const

/** Les identifiants d'équipe portés par l'URL, séparés par des virgules. */
export function equipesDepuisUrl(brut: unknown): string[] {
  if (typeof brut !== 'string' || !brut) return []
  return brut.split(',').filter(Boolean)
}

/**
 * La granularité portée par l'URL. Une valeur inventée casserait l'affichage du calendrier sans
 * rien signaler : on retombe alors sur le défaut.
 */
export function granulariteDepuisUrl(brut: unknown): number {
  const valeur = parseInt(String(brut), 10)
  return (GRANULARITES_ADMISES as readonly number[]).includes(valeur)
    ? valeur
    : GRANULARITE_PAR_DEFAUT
}

/**
 * Écarte les équipes que l'URL cite mais qui n'existent plus — un lien ancien, une équipe
 * supprimée. Sans ce filtre, le planning s'affichait vide sans rien expliquer.
 *
 * Tant que les équipes ne sont pas chargées, on garde la sélection telle quelle : les effacer
 * ici perdrait le filtre de l'URL avant même de pouvoir le valider.
 */
export function equipesConnues(selection: string[], equipes: Array<{ id: string }>): string[] {
  if (equipes.length === 0) return selection
  const existantes = new Set(equipes.map((equipe) => equipe.id))
  return selection.filter((id) => existantes.has(id))
}

/**
 * La query d'URL reflétant les filtres, en préservant les autres paramètres déjà présents.
 * Une valeur au défaut est retirée plutôt qu'écrite : l'URL reste courte et lisible.
 */
export function requeteFiltres(
  queryActuelle: Record<string, unknown>,
  equipes: string[],
  granularite: number
): Record<string, string> {
  const query = { ...queryActuelle } as Record<string, string>

  if (equipes.length > 0) query.teams = equipes.join(',')
  else delete query.teams

  if (granularite !== GRANULARITE_PAR_DEFAUT) query.granularity = String(granularite)
  else delete query.granularity

  return query
}

/** Un créneau, réduit à ce dont le filtre a besoin. */
export interface CreneauFiltrable {
  teamId?: string | null
}

/**
 * Les créneaux que le filtre d'équipes laisse voir.
 *
 * Une sélection vide ne filtre rien : c'est l'état d'arrivée de l'écran, et il montre tout.
 *
 * Un créneau **sans équipe** passe toujours, même quand on filtre. Il ne relève d'aucune équipe en
 * particulier — accueil général, coup de main ponctuel — et l'écarter le rendrait invisible dès
 * qu'on regarde une équipe, alors qu'il concerne tout le monde.
 *
 * La règle vit ici parce qu'elle était lue à deux endroits : ce que le calendrier affiche, et ce
 * que l'export PDF emporte. Le second ne l'appliquait pas — on filtrait sur une équipe, on
 * exportait, et l'on obtenait le planning de toute l'édition. Une feuille imprimée ne se rattrape
 * pas : celui qui la relit le lendemain n'a aucun moyen de savoir qu'elle dit autre chose que
 * l'écran d'où elle sort.
 */
export function creneauxDesEquipes<T extends CreneauFiltrable>(
  creneaux: readonly T[],
  equipesRetenues: readonly string[]
): T[] {
  if (equipesRetenues.length === 0) return [...creneaux]

  return creneaux.filter((creneau) => !creneau.teamId || equipesRetenues.includes(creneau.teamId))
}
