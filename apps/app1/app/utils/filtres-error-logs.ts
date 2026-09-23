import { colonnesMasqueesDepuisUrl, colonnesMasqueesVersUrl } from './colonnes-url'

/**
 * Lecture et écriture, dans l'URL, de l'état du journal d'erreurs.
 *
 * Tout ce que le lecteur règle sur cette page doit survivre à un rechargement et tenir dans un
 * lien : les filtres, la pagination, mais aussi la vue — groupée ou à plat —, le tri, et les
 * colonnes qu'il a masquées. Ces trois derniers s'oubliaient à chaque F5.
 *
 * Seules les valeurs qui S'ÉCARTENT du défaut sont écrites, comme partout ailleurs dans le dépôt
 * (planning des bénévoles, administration des comptes) : une URL qui répète l'état d'arrivée ne
 * dit rien et se partage mal.
 *
 * Fonctions pures, et non lecture directe de la route dans le composant : ce sont ces règles-là
 * qui peuvent se tromper, et les vérifier ici évite de monter un routeur — même raison que
 * `filtres-planning.ts`, dont ce fichier suit la forme.
 */

export const FILTER_DEFAULTS = {
  search: '',
  status: 'unresolved',
  errorType: 'all',
  statusCode: 'all',
  path: '',
  ip: '',
  user: '',
  timeRange: '7d',
} as const

export type CleDeFiltre = keyof typeof FILTER_DEFAULTS

export const DEFAULT_PAGE_SIZE = 20

/** Les seuls champs de tri que l'API accepte. */
export const CHAMPS_DE_TRI = ['createdAt', 'statusCode', 'path'] as const
export type ChampDeTri = (typeof CHAMPS_DE_TRI)[number]

export const TRI_PAR_DEFAUT = { field: 'createdAt', dir: 'desc' } as const

export interface EtatDuJournal {
  filtres: Record<CleDeFiltre, string>
  page: number
  pageSize: number
  vueGroupee: boolean
  tri: { field: ChampDeTri; dir: 'asc' | 'desc' }
  /** Les colonnes masquées valent `false` ; l'objet vide signifie « tout est visible ». */
  visibiliteDesColonnes: Record<string, boolean>
}

/**
 * L'état courant, réduit à ce qui mérite de figurer dans l'URL.
 */
export function construireRequeteUrl(etat: EtatDuJournal): Record<string, string> {
  const q: Record<string, string> = {}

  for (const cle of Object.keys(FILTER_DEFAULTS) as CleDeFiltre[]) {
    const valeur = etat.filtres[cle]
    if (valeur && valeur !== FILTER_DEFAULTS[cle]) q[cle] = String(valeur)
  }

  if (etat.page > 1) q.page = String(etat.page)
  if (etat.pageSize && etat.pageSize !== DEFAULT_PAGE_SIZE) q.pageSize = String(etat.pageSize)

  // La vue n'est écrite que lorsqu'elle s'écarte de l'arrivée, qui est le regroupement.
  if (!etat.vueGroupee) q.vue = 'plate'

  if (etat.tri.field !== TRI_PAR_DEFAUT.field) q.tri = etat.tri.field
  if (etat.tri.dir !== TRI_PAR_DEFAUT.dir) q.triDir = etat.tri.dir

  // La règle des colonnes est commune à tous les tableaux du dépôt : elle vit dans `colonnes-url`.
  const masquees = colonnesMasqueesVersUrl(etat.visibiliteDesColonnes)
  if (masquees) q.colonnes = masquees

  return q
}

/**
 * Ce que l'URL dit de l'état, et rien de plus : les clés absentes ne sont pas rendues, à charge
 * de l'appelant de garder ses défauts.
 *
 * `colonnesMasquables` borne ce que le paramètre `colonnes` peut cacher. Sans cette liste, une URL
 * bricolée ferait disparaître la colonne d'actions ou celle du statut, que l'écran ne propose
 * justement pas de masquer.
 */
export function lireEtatDepuisUrl(
  query: Record<string, unknown>,
  colonnesMasquables: readonly string[] = []
): Partial<EtatDuJournal> {
  const etat: Partial<EtatDuJournal> = {}

  const filtres: Partial<Record<CleDeFiltre, string>> = {}
  for (const cle of Object.keys(FILTER_DEFAULTS) as CleDeFiltre[]) {
    if (typeof query[cle] === 'string') filtres[cle] = query[cle] as string
  }
  if (Object.keys(filtres).length) etat.filtres = filtres as Record<CleDeFiltre, string>

  const page = parseInt(String(query.page), 10)
  if (!isNaN(page) && page > 0) etat.page = page
  const pageSize = parseInt(String(query.pageSize), 10)
  if (!isNaN(pageSize) && pageSize > 0) etat.pageSize = pageSize

  if (query.vue === 'plate') etat.vueGroupee = false
  if (query.vue === 'groupee') etat.vueGroupee = true

  /*
   * Un champ de tri inconnu est ignoré plutôt que transmis.
   *
   * L'API n'en accepte que trois ; lui en passer un quatrième ferait échouer le chargement sur une
   * URL qu'on a pu partager, et l'écran s'ouvrirait vide sans dire pourquoi.
   */
  const champ = String(query.tri)
  const dir = String(query.triDir)
  const champValide = (CHAMPS_DE_TRI as readonly string[]).includes(champ)
  const dirValide = dir === 'asc' || dir === 'desc'
  if (champValide || dirValide) {
    etat.tri = {
      field: champValide ? (champ as ChampDeTri) : TRI_PAR_DEFAUT.field,
      dir: dirValide ? (dir as 'asc' | 'desc') : TRI_PAR_DEFAUT.dir,
    }
  }

  if (typeof query.colonnes === 'string' && query.colonnes) {
    etat.visibiliteDesColonnes = colonnesMasqueesDepuisUrl(query.colonnes, colonnesMasquables)
  }

  return etat
}
