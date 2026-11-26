/**
 * Le cache hors ligne du service worker, commun à app1 et à Flowvent.
 *
 * Chaque app sert son propre worker (app1 y ajoute ses notifications Firebase, Flowvent n'a que
 * celui-ci) et son propre classement des requêtes (`shared/utils/offline-cache.ts`) ; les
 * STRATÉGIES de cache, elles, sont les mêmes et vivent ici — deux copies divergeraient sans que
 * rien ne le signale.
 *
 * Le classement est injecté par son SOURCE (`toString`) : la fonction doit donc se suffire à
 * elle-même, sans constante ni import extérieurs (cf. `service-worker-template.test.ts`).
 */
export interface ReglesDuCacheHorsLigne {
  /** `classifyRequest(url, destination, origin)` de l'app. */
  classifier: (...args: any[]) => unknown
  /** Noms des caches : `pages`, `assets`, `mapData`, `tiles`. */
  caches: Record<string, string>
  maxTuiles: number
  maxRessources: number
}

/**
 * Construit le bloc de cache injecté dans le worker.
 *
 * Faillible au build (injection d'un source), d'où l'exception plutôt qu'un worker cassé :
 * l'appelant la rattrape et sert un worker sans cache.
 */
export function blocDuCacheHorsLigne(regles: ReglesDuCacheHorsLigne): string {
  const classifier = regles.classifier.toString()
  if (!classifier.includes('return')) {
    throw new Error('source de classifyRequest inexploitable : ' + classifier.slice(0, 120))
  }
  return `// ---------------------------------------------------------------------------
// Cache hors ligne
// ---------------------------------------------------------------------------
//
// En convention, le réseau est souvent mauvais voire absent. Ce qui a déjà été consulté doit
// rester lisible : la carte du site et ses éléments, et les pages parcourues.
//
// Rien n'est pré-téléchargé. Seul ce que le visiteur a réellement affiché est conservé — c'est
// aussi ce qu'impose la politique d'usage des tuiles OpenStreetMap, qui interdit le
// téléchargement en masse.

const CACHES = ${JSON.stringify(regles.caches)}
const MAX_TILES = ${regles.maxTuiles}
const MAX_ASSETS = ${regles.maxRessources}

// Source injecté depuis shared/utils/offline-cache.ts de l'app, où il est testé. Ne pas le recopier :
// deux versions divergeraient sans que rien ne le signale.
const classifyRequest = ${classifier}

self.addEventListener('install', () => {
  // Prendre la main tout de suite : une version qui attendrait la fermeture de tous les onglets
  // laisserait le visiteur sans cache pendant sa visite, c'est-à-dire quand il en a besoin.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Les caches des versions précédentes ne sont plus effacés ici.
  //
  // Ils l'étaient, et le remède est devenu le mal : changer de version vidait tout, si bien
  // qu'un visiteur passant hors ligne avant d'avoir revisité en ligne se retrouvait sans rien —
  // moins bien servi qu'avant la mise à jour, alors qu'elle venait l'améliorer.
  //
  // Les entrées obsolètes ne gênent pas : les fichiers portent une empreinte dans leur nom, donc
  // les anciens ne sont plus jamais demandés. Ils seront simplement évincés par le navigateur
  // quand il aura besoin de place.
  event.waitUntil(self.clients.claim())
})

/**
 * Cherche dans le cache de la version courante, puis dans n'importe quelle autre.
 *
 * C'est ce qui donne la continuité d'une version à la suivante : le temps que les nouveaux
 * caches se remplissent, ceux de la version précédente répondent encore.
 */
async function matchAnyVersion(cache, request, options) {
  const courant = await cache.match(request, options)
  if (courant) return courant
  return caches.match(request, options)
}

/** Borne le nombre d'entrées d'un cache, en retirant les plus anciennes. */
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i])
  } catch (error) {
    // Un élagage qui échoue n'est pas une raison de faire échouer la requête en cours.
  }
}

/**
 * Marque une réponse servie par le cache, pour que l'application puisse le dire au visiteur.
 *
 * Sans ce signal, elle n'a aucun moyen de distinguer une donnée fraîche d'une donnée gardée :
 * la requête réussit dans les deux cas. L'indicateur du navigateur ne le dirait pas non plus — il vaut
 * vrai sur un réseau sans accès à Internet, c'est-à-dire le wifi d'une convention.
 */
function markAsCached(response) {
  const marked = new Response(response.body, response)
  marked.headers.set('x-from-cache', '1')
  return marked
}

/**
 * Retrouve une réponse gardée, même si les paramètres de la requête ont changé.
 *
 * Le cache s'apparie sur l'URL entière : la liste des éditions demandée avec d'autres filtres
 * — une autre page, d'autres cases cochées — ne retrouvait rien de ce qui avait été conservé,
 * et l'accueil s'affichait sur une erreur réseau. Une liste filtrée autrement vaut mieux que
 * pas de liste.
 */
async function matchTolerant(cache, request) {
  const exact = await matchAnyVersion(cache, request)
  if (exact) return exact
  return matchAnyVersion(cache, request, { ignoreSearch: true })
}

/** Sert le cache immédiatement et rafraîchit derrière : une carte datée vaut mieux que rien. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await matchTolerant(cache, request)

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined)
      return response
    })
    .catch(() => null)

  // Le réseau d'abord quand il répond vite : sur une connexion correcte, rien ne justifie
  // d'afficher une donnée datée. C'est seulement quand il tarde ou échoue que le cache prend
  // le relais, et c'est alors que le visiteur doit le savoir.
  if (!cached) return (await network) || Response.error()

  // Quand le navigateur se sait hors ligne, attendre ne sert à rien : le délai de courtoisie
  // ci-dessous se payait alors sur chaque requête, et la page mettait plusieurs secondes de plus
  // à s'afficher — précisément là où le cache devait la rendre instantanée.
  //
  // L'indicateur du navigateur ne dit pas la vérité dans un sens — il vaut vrai sur un réseau
  // sans accès à Internet — mais il la dit dans l'autre : s'il annonce hors ligne, il l'est.
  if (self.navigator && self.navigator.onLine === false) return markAsCached(cached)

  const raced = await Promise.race([
    network,
    new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
  ])
  if (raced && raced.ok) return raced
  return markAsCached(cached)
}

/** Contenu immuable — tuile ou fichier de build : le cache d'abord, le réseau s'il manque. */
async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await matchAnyVersion(cache, request)
  if (cached) return cached
  let response
  try {
    response = await fetch(request)
  } catch (error) {
    return Response.error()
  }

  // Une réponse en erreur ne doit surtout pas être gardée : ces caches servent en priorité et
  // sans expiration, si bien qu'un 404 passager condamnerait la ressource durablement, y compris
  // une fois le réseau revenu.
  //
  // Les tuiles font exception par nature : venant d'un autre domaine, elles arrivent en réponse
  // opaque, dont le statut est illisible. Elles s'affichent pourtant, et une erreur réseau lève
  // plutôt que de produire une telle réponse.
  if (response && (response.ok || response.type === 'opaque')) {
    // L'écriture est volontairement hors du chemin de la réponse. Elle peut échouer — quota du
    // navigateur atteint, notamment sur un téléphone — et cet échec ne doit pas transformer une
    // réponse parfaitement valide en erreur, ce qui reviendrait à casser le site faute de place.
    cache
      .put(request, response.clone())
      .then(() => trimCache(cacheName, maxEntries))
      .catch(() => undefined)
  }
  return response
}

/** Le réseau d'abord pour les pages : la version en cache ne sert qu'en cas d'échec. */
async function networkFirstPage(request) {
  const cache = await caches.open(CACHES.pages)

  // Hors ligne avéré : inutile de tenter le réseau et d'attendre son échec.
  if (self.navigator && self.navigator.onLine === false) {
    const cached = await matchAnyVersion(cache, request)
    if (cached) return cached
  }

  try {
    const response = await fetch(request)
    // Écriture hors du chemin de la réponse, pour la même raison que ci-dessus.
    if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined)
    return response
  } catch (error) {
    const cached = await matchAnyVersion(cache, request)
    if (cached) return cached
    throw error
  }
}

// En développement, le dossier des fichiers de build sert des modules qui changent à chaque
// édition du code : les mettre en cache fige l'application et casse le rechargement à chaud. Le
// cache n'a donc de sens qu'en production, où ces fichiers portent une empreinte et ne changent
// jamais de contenu.
const CACHE_ENABLED = ${process.env.NODE_ENV === 'production'}

self.addEventListener('fetch', (event) => {
  if (!CACHE_ENABLED) return

  const request = event.request
  // Seules les lectures se mettent en cache : rejouer un envoi serait une action, pas un
  // affichage.
  if (request.method !== 'GET') return

  const kind = classifyRequest(request.url, request.destination, self.location.origin)
  if (!kind) return

  if (kind === 'tile') event.respondWith(cacheFirst(request, CACHES.tiles, MAX_TILES))
  else if (kind === 'asset') event.respondWith(cacheFirst(request, CACHES.assets, MAX_ASSETS))
  else if (kind === 'map-data') event.respondWith(staleWhileRevalidate(request, CACHES.mapData))
  else if (kind === 'page') event.respondWith(networkFirstPage(request))
})
`
}
