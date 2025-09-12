// Service Worker pour les notifications push
console.log('[Service Worker] Démarrage...')

// Événement d'installation
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...')
  self.skipWaiting()
})

// Événement d'activation
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...')
  event.waitUntil(clients.claim())
})

// Réception des notifications push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Notification push reçue')

  if (!event.data) {
    console.warn('[Service Worker] Notification sans données')
    return
  }

  try {
    const data = event.data.json()
    console.log('[Service Worker] Données de notification:', data)

    // Options de notification
    const options = {
      body: data.message || data.body || 'Nouvelle notification',
      icon: '/favicons/android-chrome-192x192.png',
      badge: '/favicons/favicon-32x32.png',
      vibrate: [200, 100, 200],
      timestamp: new Date().getTime(),
      tag: data.id || 'notification',
      renotify: true,
      requireInteraction: false,
      data: {
        url: data.actionUrl || data.url || '/',
        notificationId: data.id,
      },
    }

    // Ajouter des actions si disponibles
    if (data.actionUrl) {
      options.actions = [
        {
          action: 'open',
          title: data.actionText || 'Voir',
          icon: '/favicons/favicon-32x32.png',
        },
        {
          action: 'close',
          title: 'Fermer',
          icon: '/favicons/favicon-32x32.png',
        },
      ]
    }

    // Afficher la notification
    event.waitUntil(
      self.registration.showNotification(data.title || 'Convention de Jonglerie', options)
    )
  } catch (error) {
    console.error('[Service Worker] Erreur lors du traitement de la notification:', error)
  }
})

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Clic sur notification')
  event.notification.close()

  const data = event.notification.data
  const url = data?.url || '/'

  // Ouvrir l'URL dans un nouvel onglet ou focus sur un onglet existant
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Chercher si l'app est déjà ouverte
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(url)
            }
          })
        }
      }
      // Si l'app n'est pas ouverte, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Événement de fermeture de notification
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification fermée')
})

// Test de ping pour vérifier que le service worker est actif
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    console.log('[Service Worker] Ping reçu')
    event.ports[0].postMessage({ type: 'PONG' })
  }
})
