/**
 * Endpoint pour servir dynamiquement le Service Worker Firebase
 * avec la configuration de l'environnement actuel
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

// Import des scripts Firebase pour le service worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Configuration Firebase (injectée dynamiquement selon l'environnement)
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)}

// Initialiser Firebase dans le service worker
firebase.initializeApp(firebaseConfig)

// Récupérer l'instance de messaging
const messaging = firebase.messaging()

// Gérer les messages en arrière-plan (quand l'app n'est pas au premier plan)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload)

  // Personnaliser la notification
  const notificationTitle = payload.notification?.title || 'Nouvelle notification'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/favicons/android-chrome-192x192.png',
    badge: payload.notification?.badge || '/favicons/notification-badge.png',
    tag: payload.data?.id || 'notification',
    requireInteraction: false,
    data: payload.data,
  }

  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions)
})

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification cliquée:', event)

  event.notification.close()

  // Ouvrir ou focus l'application
  const urlToOpen = event.notification.data?.actionUrl || '/'

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
`

  // Définir les headers appropriés pour un Service Worker
  setResponseHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setResponseHeader(event, 'Service-Worker-Allowed', '/')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return swContent
})
