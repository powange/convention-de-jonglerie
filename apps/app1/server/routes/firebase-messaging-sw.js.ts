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
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification cliquée:', event)

  event.notification.close()

  // Ouvrir ou focus l'application
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Vérifier si une fenêtre est déjà ouverte
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i]
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((client) => {
              // Naviguer vers l'URL si nécessaire
              if (urlToOpen && 'navigate' in client) {
                return client.navigate(urlToOpen)
              }
              return client
            })
          }
        }
        // Si aucune fenêtre n'est ouverte, en ouvrir une nouvelle
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// ---------------------------------------------------------------------------
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
const classifyRequest = ${classifyRequest.toString()}

self.addEventListener('install', () => {
  // Prendre la main tout de suite : une version qui attendrait la fermeture de tous les onglets
  // laisserait le visiteur sans cache pendant sa visite, c'est-à-dire quand il en a besoin.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = Object.values(CACHES)
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((name) => (keep.indexOf(name) === -1 ? caches.delete(name) : null)))
      )
      .then(() => self.clients.claim())
  )
})

/** Borne le nombre d'entrées d'un cache, en retirant les plus anciennes. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i])
}

/** Sert le cache immédiatement et rafraîchit derrière : une carte datée vaut mieux que rien. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

/** Contenu immuable — tuile ou fichier de build : le cache d'abord, le réseau s'il manque. */
async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    // Les tuiles arrivent en réponse opaque : son statut est illisible, mais elle s'affiche.
    // Une erreur réseau, elle, lève et n'est donc jamais mise en cache.
    if (response) {
      await cache.put(request, response.clone())
      trimCache(cacheName, maxEntries)
    }
    return response
  } catch (error) {
    return Response.error()
  }
}

/** Le réseau d'abord pour les pages : la version en cache ne sert qu'en cas d'échec. */
async function networkFirstPage(request) {
  const cache = await caches.open(CACHES.pages)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
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

  // Définir les headers appropriés pour un Service Worker
  setResponseHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setResponseHeader(event, 'Service-Worker-Allowed', '/')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return swContent
})
