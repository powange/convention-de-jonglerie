/**
 * Politique de cache hors ligne, partagée entre le service worker et ses tests.
 *
 * En convention, le réseau est souvent mauvais voire absent. Ce qui a déjà été consulté doit
 * rester lisible : la carte du site, ses zones et ses points de repère, et les pages parcourues.
 *
 * Le service worker est un script autonome, qui n'importe pas les modules de l'application. La
 * fonction de classement ci-dessous lui est donc **injectée sous forme de source** : c'est ce
 * qui permet de la tester ici plutôt que de la réécrire en double dans le worker, où rien ne la
 * vérifierait.
 */

/** Nom des caches. La version force le renouvellement quand la politique change. */
export const OFFLINE_CACHE_VERSION = 'v1'
export const OFFLINE_CACHES = {
  pages: `pages-${OFFLINE_CACHE_VERSION}`,
  assets: `assets-${OFFLINE_CACHE_VERSION}`,
  mapData: `map-data-${OFFLINE_CACHE_VERSION}`,
  tiles: `tiles-${OFFLINE_CACHE_VERSION}`,
} as const

/**
 * Nombre de tuiles conservées.
 *
 * Une tuile pèse une vingtaine de kilo-octets et les réponses opaques comptent double dans le
 * quota du navigateur. Ce plafond couvre largement le site d'une convention parcouru à plusieurs
 * niveaux de zoom, sans occuper l'espace d'un visiteur qui n'y reviendra pas.
 */
export const MAX_CACHED_TILES = 600

/**
 * Nombre de fichiers de build conservés.
 *
 * Leur nom porte une empreinte : une nouvelle version produit de nouveaux noms plutôt que de
 * remplacer les anciens. Sans plafond, chaque déploiement laisserait sa strate derrière lui.
 */
export const MAX_CACHED_ASSETS = 200

export type CacheKind = 'page' | 'map-data' | 'tile' | 'asset' | null

/**
 * Détermine comment traiter une requête, ou `null` pour la laisser passer.
 *
 * **Cette fonction doit rester autonome** : son source est injecté tel quel dans le service
 * worker, donc elle ne peut référencer aucune valeur extérieure — un identifiant renommé par le
 * bundler y deviendrait introuvable. Un test reconstruit la fonction depuis son propre source
 * pour vérifier qu'elle survit à cette injection.
 *
 * @param url URL absolue de la requête
 * @param destination `request.destination` — `'document'` pour une navigation
 * @param origin Origine du site, pour distinguer nos requêtes des tierces
 */
export function classifyRequest(url: string, destination: string, origin: string): CacheKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // Fonds de carte : les seuls hôtes tiers dont on garde quelque chose. Uniquement ce que le
  // visiteur a réellement affiché — pré-télécharger une zone contreviendrait à la politique
  // d'usage des tuiles OpenStreetMap.
  const tileHosts = ['tile.openstreetmap.org', 'server.arcgisonline.com']
  if (tileHosts.indexOf(parsed.hostname) !== -1) return 'tile'

  if (parsed.origin !== origin) return null

  // Données de la carte d'une édition : petites, et c'est ce qui porte tout le contenu.
  if (/^\/api\/editions\/\d+\/(zones|markers)(\/|$)/.test(parsed.pathname)) return 'map-data'

  // Le reste de l'API n'est pas mis en cache : une commande ou un droit périmé induirait en
  // erreur bien plus qu'une carte datée.
  if (parsed.pathname.indexOf('/api/') === 0) return null

  // Fichiers de build. Une page en cache sans eux s'affiche vide : le rendu serveur arrive, mais
  // l'application ne peut pas reprendre la main. Leur nom portant une empreinte, ils ne changent
  // jamais de contenu — le cache prime donc sur le réseau.
  if (parsed.pathname.indexOf('/_nuxt/') === 0) return 'asset'

  if (destination === 'document') return 'page'

  return null
}

/**
 * Pages conservées pour être consultables hors ligne.
 *
 * La liste est volontairement courte. Garder une page suppose de la demander une seconde fois
 * au moment où le worker prend la main — un coût réel sur les connexions lentes, justement
 * celles qu'on cherche à soulager. On s'en tient donc à ce qui sert vraiment sur place : la
 * carte du site, et l'accueil comme point d'entrée.
 */
export function shouldPrecachePage(pathname: string): boolean {
  if (pathname === '/') return true
  return /^\/editions\/\d+\/map\/?$/.test(pathname)
}
