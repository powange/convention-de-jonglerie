import { getToken, onMessage, type MessagePayload } from 'firebase/messaging'

/**
 * Composable pour gérer Firebase Cloud Messaging
 */
export function useFirebaseMessaging() {
  const { $firebase } = useNuxtApp()
  const toast = useToast()
  const config = useRuntimeConfig()
  const { getDeviceId } = useDeviceId()

  // Cache pour éviter les appels trop fréquents
  let lastTokenRequest = 0
  const TOKEN_REQUEST_COOLDOWN = 5000 // 5 secondes

  /**
   * Enregistrer le service worker Firebase
   */
  const registerServiceWorker = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers non supportés')
      return false
    }

    try {
      // Désinscrire tous les anciens Service Workers Firebase d'abord
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        if (registration.active?.scriptURL.includes('firebase-messaging-sw')) {
          console.log('🗑️ Désinstallation ancien SW Firebase:', registration.active.scriptURL)
          await registration.unregister()
        }
      }

      // Enregistrer le nouveau Service Worker avec option de mise à jour forcée
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        updateViaCache: 'none', // Ne jamais utiliser le cache
      })

      // Forcer la mise à jour immédiate
      await registration.update()

      // Si un nouveau SW est en attente, le forcer à s'activer
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Attendre que le SW soit prêt
      await navigator.serviceWorker.ready

      console.log('✅ Service Worker Firebase enregistré:', registration.scope)
      return true
    } catch (error) {
      console.error("❌ Erreur lors de l'enregistrement du Service Worker Firebase:", error)
      return false
    }
  }

  /**
   * Demander la permission pour les notifications et obtenir le token FCM
   */
  const requestPermissionAndGetToken = async (): Promise<string | null> => {
    if (!$firebase.messaging) {
      console.warn('Firebase Messaging non disponible')
      return null
    }

    // Vérifier le cooldown pour éviter les appels trop fréquents
    const now = Date.now()
    if (now - lastTokenRequest < TOKEN_REQUEST_COOLDOWN) {
      console.warn(
        `⏱️ Attendez ${Math.ceil((TOKEN_REQUEST_COOLDOWN - (now - lastTokenRequest)) / 1000)}s avant de redemander le token`
      )
      return null
    }
    lastTokenRequest = now

    try {
      // 1. Enregistrer le Service Worker en premier
      console.log('📝 Enregistrement du Service Worker Firebase...')
      const swRegistered = await registerServiceWorker()
      if (!swRegistered) {
        console.error("❌ Impossible d'enregistrer le Service Worker")
        return null
      }

      // 2. Demander la permission
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        console.log('Permission de notification refusée')
        return null
      }

      // 3. Récupérer la clé VAPID depuis la configuration
      const vapidKey = config.public.firebaseVapidKey

      if (!vapidKey) {
        console.error('❌ VAPID key manquante. Configurez NUXT_PUBLIC_FIREBASE_VAPID_KEY dans .env')
        return null
      }

      console.log('🔑 Utilisation de la clé VAPID:', vapidKey.substring(0, 20) + '...')

      // 4. Obtenir le token FCM avec le Service Worker enregistré
      const registration = await navigator.serviceWorker.ready
      console.log('✅ Service Worker prêt')

      console.log('⏳ Demande du token FCM...')

      const token = await getToken($firebase.messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })

      if (token) {
        console.log('✅ Token FCM obtenu:', token.substring(0, 20) + '...')

        // Enregistrer le token côté serveur avec le deviceId
        try {
          const deviceId = getDeviceId()
          await $fetch('/api/notifications/fcm/subscribe', {
            method: 'POST',
            body: { token, deviceId },
          })
          console.log('✅ Token FCM enregistré côté serveur')
        } catch (error) {
          console.error("❌ Erreur lors de l'enregistrement du token FCM:", error)
        }

        return token
      } else {
        console.log("❌ Impossible d'obtenir le token FCM")
        return null
      }
    } catch (error: any) {
      // Détecter si c'est Opera
      const isOpera =
        navigator.userAgent.indexOf('OPR') > -1 || navigator.userAgent.indexOf('Opera') > -1

      if (error.name === 'AbortError' && error.message.includes('push service error')) {
        if (isOpera) {
          console.warn('⚠️ Opera ne supporte pas correctement Firebase Cloud Messaging')
          console.warn('   Utilisez Chrome, Edge ou Firefox pour les notifications push')

          // Afficher un toast informatif
          toast.add({
            title: 'Navigateur non compatible',
            description:
              'Les notifications push ne sont pas supportées sur Opera. Utilisez Chrome, Edge ou Firefox.',
            color: 'amber',
            icon: 'i-heroicons-exclamation-triangle',
            timeout: 8000,
          })
        } else {
          console.error('❌ Erreur de service push:', error)
          console.error('⚠️ Vérifiez que votre navigateur supporte les notifications push')

          toast.add({
            title: 'Erreur de notifications',
            description:
              "Impossible d'activer les notifications. Essayez avec un autre navigateur.",
            color: 'red',
            icon: 'i-heroicons-x-circle',
            timeout: 5000,
          })
        }
      } else {
        // Autre type d'erreur
        console.error('❌ Erreur lors de la demande de permission FCM:', error)

        toast.add({
          title: 'Erreur',
          description: "Une erreur est survenue lors de l'activation des notifications.",
          color: 'red',
          icon: 'i-heroicons-x-circle',
          timeout: 5000,
        })
      }

      return null
    }
  }

  /**
   * Désactiver les notifications FCM (désabonner le token actuel)
   */
  const unsubscribe = async (): Promise<boolean> => {
    try {
      // Appeler l'API pour désactiver le token côté serveur
      await $fetch('/api/notifications/fcm/unsubscribe', {
        method: 'POST',
      })
      console.log('✅ Token FCM désactivé côté serveur')
      return true
    } catch (error) {
      console.error('❌ Erreur lors de la désactivation du token FCM:', error)
      return false
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

  return {
    requestPermissionAndGetToken,
    unsubscribe,
    listenToMessages,
    registerServiceWorker,
    isAvailable: computed(() => !!$firebase.messaging),
  }
}
