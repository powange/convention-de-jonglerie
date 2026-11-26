/**
 * Cache hors ligne de Flowvent : ce que le service worker garde, et comment il le reconnaît.
 *
 * Contrat d'hôte du plugin de cache du layer `ui` (`#shared/utils/offline-cache`) et de la route du
 * worker (`server/routes/sw.js.ts`), qui reprend les stratégies communes de
 * `#core/server/socle/cache-hors-ligne-sw`. Même principe qu'app1 : seul ce que le visiteur a
 * réellement affiché est conservé — les pages parcourues, les fichiers de build, les traductions,
 * les icônes, la carte du site.
 *
 * ⚠️ `classifyRequest` est injectée dans le worker par son SOURCE : elle ne doit dépendre d'aucune
 * constante ni d'aucun import extérieurs (cf. `service-worker-template`).
 */

export const OFFLINE_CACHE_VERSION = 'v1'
export const OFFLINE_CACHES = {
  pages: `flowvent-pages-${OFFLINE_CACHE_VERSION}`,
  assets: `flowvent-assets-${OFFLINE_CACHE_VERSION}`,
  mapData: `flowvent-map-data-${OFFLINE_CACHE_VERSION}`,
  tiles: `flowvent-tiles-${OFFLINE_CACHE_VERSION}`,
} as const

/** Tuiles de fond de carte gardées au plus (celles réellement affichées). */
export const MAX_CACHED_TILES = 600

/** Fichiers de build, traductions et icônes gardés au plus. */
export const MAX_CACHED_ASSETS = 1500

export type CacheKind = 'page' | 'map-data' | 'tile' | 'asset' | null

/**
 * Le sort d'une requête : quel cache, ou aucun.
 *
 * Différences avec app1 : ni liste ni fiche publique d'éditions à garder — les données d'un
 * événement Flowvent sont privées, et une donnée de gestion périmée induirait en erreur. Seule la
 * carte du site (zones, repères) l'est, comme dans app1.
 */
export function classifyRequest(url: string, destination: string, origin: string): CacheKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // Fonds de carte : les seuls hôtes tiers dont on garde quelque chose, et seulement ce qui a été
  // affiché (politique d'usage des tuiles OpenStreetMap).
  const tileHosts = ['tile.openstreetmap.org', 'server.arcgisonline.com']
  if (tileHosts.indexOf(parsed.hostname) !== -1) return 'tile'

  if (parsed.origin !== origin) return null

  // Carte du site d'un événement : zones et repères.
  if (/^\/api\/editions\/\d+\/(zones|markers)(\/|$)/.test(parsed.pathname)) return 'map-data'

  // Collections d'icônes, servies par l'API mais publiques et stables.
  if (parsed.pathname.indexOf('/api/_nuxt_icon/') === 0) return 'asset'

  // Le reste de l'API n'est pas mis en cache.
  if (parsed.pathname.indexOf('/api/') === 0) return null

  // Fichiers de build (`_nuxt` ou `_nuxt-<empreinte>`, cf. `buildAssetsDir`) : nom à empreinte,
  // contenu immuable.
  if (/^\/_nuxt(-[A-Za-z0-9]+)?\//.test(parsed.pathname)) return 'asset'

  // Traductions prérendues.
  if (parsed.pathname.indexOf('/_i18n/') === 0) return 'asset'

  if (destination === 'document') return 'page'

  return null
}

/** Données à garder dès la première visite (cf. app1) : aucune dans Flowvent. */
export const DONNEES_A_CONSERVER: { cle: string; url: string }[] = []

/**
 * Pages mises de côté explicitement (la première visite n'est jamais vue par le worker) :
 * l'accueil seulement, comme app1. Les pages privées (tableau de bord, gestion) ne sont gardées
 * qu'une fois parcourues, par le worker.
 */
export function shouldPrecachePage(pathname: string): boolean {
  return pathname === '/'
}

/**
 * L'adresse du worker, avec l'identifiant du build : le navigateur ne relit un worker que si son
 * adresse change, et un worker resté sur un ancien build garderait d'anciennes règles.
 */
export function serviceWorkerUrl(buildId: string | undefined): string {
  return buildId ? `/sw.js?build=${encodeURIComponent(buildId)}` : '/sw.js'
}
