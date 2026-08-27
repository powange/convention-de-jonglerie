import {
  classifyRequest,
  MAX_CACHED_ASSETS,
  MAX_CACHED_TILES,
  OFFLINE_CACHES,
} from '~~/shared/utils/offline-cache'

/**
 * Endpoint servant dynamiquement l'unique Service Worker du site.
 *
 * Il porte deux rôles : les notifications push, et le cache hors ligne. Ils cohabitent dans le
 * même fichier parce qu'un navigateur n'accepte **qu'un seul service worker par portée** — en
 * enregistrer un second sur « / » évincerait celui-ci et couperait les notifications sans le
 * moindre signal.
 */
/**
 * Construit le bloc de cache injecté dans le worker.
 *
 * Le classement des requêtes vient de shared/utils/offline-cache.ts, où il est testé : son
 * source est injecté plutôt que recopié, deux versions divergeraient sans que rien ne le
 * signale. C'est aussi ce qui rend cette construction faillible au build, d'où son isolement.
 */
function buildCacheBlock(): string {
  const classifier = classifyRequest.toString()
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

const CACHES = ${JSON.stringify(OFFLINE_CACHES)}
const MAX_TILES = ${MAX_CACHED_TILES}
const MAX_ASSETS = ${MAX_CACHED_ASSETS}

// Source injecté depuis shared/utils/offline-cache.ts, où il est testé. Ne pas le recopier ici :
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

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()

  // Récupérer la configuration Firebase depuis les variables d'environnement
  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey || 'AIzaSyAVDttdYlK-jAxvj06Nui-DRwf5Jj2GvHg',
    authDomain: config.public.firebaseAuthDomain || 'juggling-convention.firebaseapp.com',
    projectId: config.public.firebaseProjectId || 'juggling-convention',
    storageBucket: config.public.firebaseStorageBucket || 'juggling-convention.firebasestorage.app',
    messagingSenderId: config.public.firebaseMessagingSenderId || '136924576295',
    appId: config.public.firebaseAppId || '1:136924576295:web:b9d515a218409804c9ec02',
  }

  // Générer un hash de version basé sur le projectId pour forcer le reload du SW quand la config change
  const swVersion = `v2-${firebaseConfig.projectId}`

  /**
   * Bloc de cache, construit à part et de façon défensive.
   *
   * Il repose sur l'injection du source d'une fonction importée. Si cette injection échoue —
   * ce qui n'arrive qu'au build de production, et s'est produit une fois — la route entière
   * cessait d'être servie : plus de worker du tout, donc ni notifications push ni cache, pour
   * une 502 opaque côté Cloudflare.
   *
   * Le worker est désormais toujours servi. En cas d'échec, il perd son cache mais garde les
   * notifications, et porte la cause en commentaire — seul moyen de la lire depuis un
   * environnement dont les journaux ne me sont pas accessibles.
   */
  let cacheBlock: string
  try {
    cacheBlock = buildCacheBlock()
  } catch (error) {
    cacheBlock = `// Cache hors ligne indisponible : ${
      error instanceof Error ? error.message : String(error)
    }`
  }

  // Générer le contenu du Service Worker avec la config injectée
  const swContent = `/**
 * Service Worker Firebase Cloud Messaging
 * Gère les notifications push en arrière-plan
 * Configuration générée dynamiquement pour l'environnement: ${process.env.NODE_ENV}
 * Version: ${swVersion}
 */

// Version du Service Worker (change quand la configuration Firebase change)
const SW_VERSION = '${swVersion}'

// Configuration Firebase (injectée dynamiquement selon l'environnement)
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)}

// Firebase se charge depuis un CDN. Hors ligne — le cas même où ce worker sert le plus — cet
// import échoue, et une exception ici emporterait tout le script : plus de cache non plus.
// D'où l'isolement : les notifications se passent d'un CDN injoignable, le cache non.
let messaging = null
try {
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')
  firebase.initializeApp(firebaseConfig)
  messaging = firebase.messaging()
} catch (error) {
  console.warn('[sw] Firebase indisponible, le cache hors ligne reste actif:', error)
}

// Gérer les messages en arrière-plan (quand l'app n'est pas au premier plan)
if (messaging) messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload)

  // Les données sont dans payload.data (messages data-only pour éviter les doublons)
  const data = payload.data || {}

  // Personnaliser la notification
  const notificationTitle = data.title || 'Nouvelle notification'
  const notificationOptions = {
    body: data.body || '',
    // Utiliser l'icon fourni (avatar pour les messages) ou le logo par défaut
    icon: data.icon || '/favicons/android-chrome-192x192.png',
    badge: '/favicons/notification-badge.png',
    tag: data.id || 'notification',
    requireInteraction: false,
    data: data,
  }

  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions)
})

// Gérer le clic sur la notification
//
// Le point délicat est client.navigate() : il lève une exception sur une fenêtre que ce
// Service Worker ne contrôle pas — cas courant sur mobile, la recherche se faisant avec
// includeUncontrolled. L'ancienne version laissait alors l'exception remonter :
// la fenêtre passait au premier plan sans bouger, restant sur la page déjà affichée. Un
// artiste cliquant sur « Confirmer la lecture » retombait ainsi sur l'édition en cours.
//
// D'où l'ordre suivi ici : une fenêtre déjà sur la bonne page est simplement mise au
// premier plan ; sinon on tente de la faire naviguer ; et tout échec retombe sur
// l'ouverture d'une fenêtre neuve, qui elle aboutit toujours.
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification cliquée:', event)

  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'
  const urlAbsolue = new URL(urlToOpen, self.location.origin).href

  const ouvrirNouvelleFenetre = () =>
    clients.openWindow ? clients.openWindow(urlAbsolue) : undefined

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const fenetres = windowClients.filter(
          (client) => client.url.startsWith(self.location.origin) && 'focus' in client
        )

        // Déjà au bon endroit : inutile de renaviguer, on remet au premier plan
        const dejaSurLaPage = fenetres.find((client) => client.url === urlAbsolue)
        if (dejaSurLaPage) {
          return dejaSurLaPage.focus()
        }

        const fenetre = fenetres[0]
        if (!fenetre) {
          return ouvrirNouvelleFenetre()
        }

        return fenetre
          .focus()
          .then((client) => {
            if (!client || typeof client.navigate !== 'function') {
              return ouvrirNouvelleFenetre()
            }
            // navigate() échoue sur une fenêtre non contrôlée : dans ce cas, mieux vaut
            // une fenêtre neuve qu'une fenêtre au premier plan restée sur sa page.
            return client.navigate(urlAbsolue).catch((erreur) => {
              console.warn('[firebase-messaging-sw.js] navigate() a échoué, ouverture directe:', erreur)
              return ouvrirNouvelleFenetre()
            })
          })
          .catch(() => ouvrirNouvelleFenetre())
      })
      .catch((erreur) => {
        console.warn('[firebase-messaging-sw.js] matchAll() a échoué, ouverture directe:', erreur)
        return ouvrirNouvelleFenetre()
      })
  )
})

${cacheBlock}
`

  // Définir les headers appropriés pour un Service Worker
  setResponseHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setResponseHeader(event, 'Service-Worker-Allowed', '/')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return swContent
})
