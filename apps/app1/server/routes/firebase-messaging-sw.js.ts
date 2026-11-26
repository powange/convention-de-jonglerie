import { blocDuCacheHorsLigne } from '#core/server/socle/cache-hors-ligne-sw'
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
 * Le bloc de cache, commun avec Flowvent (`#core/server/socle/cache-hors-ligne-sw`), nourri du
 * classement des requêtes d'app1.
 */
function buildCacheBlock(): string {
  return blocDuCacheHorsLigne({
    classifier: classifyRequest,
    caches: OFFLINE_CACHES,
    maxTuiles: MAX_CACHED_TILES,
    maxRessources: MAX_CACHED_ASSETS,
  })
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
