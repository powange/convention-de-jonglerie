// Service Worker pour les notifications push

// Événement d'installation
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Événement d'activation
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Réception des notifications push
self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  try {
    const data = event.data.json()

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

// Test de ping pour vérifier que le service worker est actif
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG' })
  }

  // Force l'activation du nouveau Service Worker
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
