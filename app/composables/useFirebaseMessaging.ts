import { getToken, onMessage, type MessagePayload } from 'firebase/messaging'

/**
 * Composable pour gérer Firebase Cloud Messaging
 */
export function useFirebaseMessaging() {
  const { $firebase } = useNuxtApp()
  const toast = useToast()

  /**
   * Demander la permission pour les notifications et obtenir le token FCM
   */
  const requestPermissionAndGetToken = async (): Promise<string | null> => {
    if (!$firebase.messaging) {
      console.warn('Firebase Messaging non disponible')
      return null
    }

    try {
      // Demander la permission
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        console.log('Permission de notification refusée')
        return null
      }

      // Note: La VAPID key doit être obtenue depuis Firebase Console
      // Project Settings > Cloud Messaging > Web Push certificates
      // Pour l'instant, on utilise le système VAPID existant
      const token = await getToken($firebase.messaging, {
        // serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
      })

      if (token) {
        console.log('✅ Token FCM obtenu:', token.substring(0, 20) + '...')
        return token
      } else {
        console.log('❌ Impossible d\'obtenir le token FCM')
        return null
      }
    } catch (error) {
      console.error('Erreur lors de la demande de permission FCM:', error)
      return null
    }
  }

  /**
   * Écouter les messages en temps réel (foreground)
   */
  const listenToMessages = (
    callback: (payload: MessagePayload) => void = (payload) => {
      console.log('Message reçu en foreground:', payload)

      // Afficher un toast par défaut
      if (payload.notification) {
        toast.add({
          title: payload.notification.title || 'Notification',
          description: payload.notification.body || '',
          color: 'primary',
          icon: 'i-heroicons-bell',
        })
      }
    }
  ) => {
    if (!$firebase.messaging) {
      console.warn('Firebase Messaging non disponible')
      return () => {}
    }

    // Écouter les messages quand l'app est au premier plan
    const unsubscribe = onMessage($firebase.messaging, callback)

    return unsubscribe
  }

  /**
   * Enregistrer le service worker Firebase
   */
  const registerServiceWorker = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers non supportés')
      return false
    }

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      console.log('✅ Service Worker Firebase enregistré:', registration.scope)
      return true
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement du Service Worker Firebase:', error)
      return false
    }
  }

  return {
    requestPermissionAndGetToken,
    listenToMessages,
    registerServiceWorker,
    isAvailable: computed(() => !!$firebase.messaging),
  }
}
