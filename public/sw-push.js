/**
 * Service Worker pour les notifications push
 * Gère la réception et l'affichage des notifications push
 */

// Événement de réception d'une notification push
self.addEventListener('push', function (event) {
  console.log('📱 Notification push reçue:', event)

  if (!event.data) {
    console.log('❌ Pas de données dans la notification push')
    return
  }

  let notificationData
  try {
    notificationData = event.data.json()
  } catch (error) {
    console.error('❌ Erreur de parsing des données push:', error)
    return
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/favicons/favicon-192x192.png',
    badge: notificationData.badge || '/favicons/favicon-96x96.png',
    image: notificationData.image,
    data: {
      url: notificationData.data?.url || '/',
      timestamp: notificationData.data?.timestamp || Date.now(),
      notificationId: notificationData.data?.notificationId,
    },
    tag: notificationData.tag || 'convention-notification',
    requireInteraction: notificationData.requireInteraction || false,
    actions: notificationData.actions || [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/favicons/favicon-64x64.png',
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/favicons/favicon-64x64.png',
      },
    ],
    vibrate: [200, 100, 200], // Vibration sur mobile
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log('✅ Notification affichée avec succès')
      })
      .catch((error) => {
        console.error('❌ Erreur lors de l\'affichage de la notification:', error)
      })
  )
})

// Événement de clic sur la notification
self.addEventListener('notificationclick', function (event) {
  console.log('🖱️ Clic sur notification:', event.notification.tag, event.action)

  const notification = event.notification
  const action = event.action
  const data = notification.data || {}

  // Fermer la notification
  notification.close()

  if (action === 'close') {
    // Action fermer - ne rien faire de plus
    return
  }

  // Déterminer l'URL à ouvrir
  let urlToOpen = data.url || '/'
  
  if (action === 'open' || !action) {
    // Action par défaut ou bouton "Ouvrir"
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Chercher une fenêtre existante
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i]
            const clientUrl = new URL(client.url)
            const targetUrl = new URL(urlToOpen, self.location.origin)
            
            // Si on trouve une fenêtre du même domaine, la focus et naviguer
            if (clientUrl.origin === targetUrl.origin) {
              client.navigate(targetUrl.href)
              return client.focus()
            }
          }
          
          // Sinon, ouvrir une nouvelle fenêtre
          return clients.openWindow(urlToOpen)
        })
        .catch((error) => {
          console.error('❌ Erreur lors de l\'ouverture de l\'URL:', error)
        })
    )
  }
})

// Événement de fermeture de la notification
self.addEventListener('notificationclose', function (event) {
  console.log('❌ Notification fermée:', event.notification.tag)
  
  // Optionnel : envoyer une statistique au serveur
  const data = event.notification.data || {}
  
  if (data.notificationId) {
    // Analytics ou tracking de fermeture
    console.log('📊 Notification fermée ID:', data.notificationId)
  }
})

// Log d'installation du service worker
self.addEventListener('install', function (event) {
  console.log('🔧 Service Worker Push installé')
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  console.log('✅ Service Worker Push activé')
  event.waitUntil(self.clients.claim())
})