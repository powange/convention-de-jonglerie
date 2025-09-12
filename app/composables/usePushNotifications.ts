import { useAuthStore } from '~/stores/auth'

interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  permission: NotificationPermission | null
  subscription: PushSubscription | null
}

export const usePushNotifications = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const toast = useToast()

  const state = reactive<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: false,
    error: null,
    permission: null,
    subscription: null,
  })

  // Vérifier le support des notifications push
  const checkSupport = () => {
    if (import.meta.client) {
      state.isSupported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

      if (state.isSupported && Notification.permission) {
        state.permission = Notification.permission
      }
    }
  }

  // Enregistrer le Service Worker
  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!state.isSupported) {
      console.warn('[Push] Service Worker non supporté')
      return null
    }

    try {
      console.log('[Push] Enregistrement du Service Worker...')
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('[Push] Service Worker enregistré avec succès')

      // Attendre que le Service Worker soit prêt
      await navigator.serviceWorker.ready

      return registration
    } catch (error) {
      console.error("[Push] Erreur lors de l'enregistrement du Service Worker:", error)
      state.error = "Impossible d'enregistrer le Service Worker"
      return null
    }
  }

  // Vérifier si l'utilisateur est déjà abonné
  const checkSubscription = async () => {
    if (!state.isSupported) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        state.isSubscribed = true
        state.subscription = subscription
        console.log('[Push] Abonnement existant trouvé')
      } else {
        state.isSubscribed = false
        state.subscription = null
      }
    } catch (error) {
      console.error("[Push] Erreur lors de la vérification de l'abonnement:", error)
    }
  }

  // Demander la permission
  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.add({
        color: 'red',
        title: 'Non supporté',
        description: 'Les notifications push ne sont pas supportées sur ce navigateur',
      })
      return false
    }

    try {
      console.log('[Push] Demande de permission...')
      const permission = await Notification.requestPermission()
      state.permission = permission

      if (permission === 'granted') {
        console.log('[Push] Permission accordée')
        return true
      } else if (permission === 'denied') {
        console.log('[Push] Permission refusée')
        toast.add({
          color: 'red',
          title: 'Permission refusée',
          description:
            'Vous avez refusé les notifications. Vous pouvez les réactiver dans les paramètres du navigateur.',
        })
        return false
      } else {
        console.log('[Push] Permission en attente')
        return false
      }
    } catch (error) {
      console.error('[Push] Erreur lors de la demande de permission:', error)
      state.error = 'Erreur lors de la demande de permission'
      return false
    }
  }

  // S'abonner aux notifications push
  const subscribe = async () => {
    if (!authStore.user) {
      toast.add({
        color: 'yellow',
        title: 'Connexion requise',
        description: 'Vous devez être connecté pour activer les notifications',
      })
      return false
    }

    if (state.isSubscribed) {
      console.log('[Push] Déjà abonné')
      return true
    }

    state.isLoading = true
    state.error = null

    try {
      // 1. Demander la permission si nécessaire
      if (state.permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          state.isLoading = false
          return false
        }
      }

      // 2. Enregistrer le Service Worker
      const registration = await registerServiceWorker()
      if (!registration) {
        state.isLoading = false
        return false
      }

      // 3. Créer l'abonnement push
      console.log('[Push] Creating subscription...')
      const vapidPublicKey = config.public.vapidPublicKey

      if (!vapidPublicKey) {
        throw new Error('Clé publique VAPID manquante')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      console.log('[Push] Abonnement créé:', subscription)

      // 4. Envoyer l'abonnement au serveur
      const { error } = await $fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        body: {
          subscription: subscription.toJSON(),
        },
      }).catch((err) => ({ data: null, error: err }))

      if (error) {
        throw error
      }

      state.isSubscribed = true
      state.subscription = subscription

      toast.add({
        color: 'green',
        title: 'Notifications activées',
        description: 'Vous recevrez maintenant des notifications push',
      })

      console.log('[Push] Abonnement réussi')
      return true
    } catch (error) {
      console.error("[Push] Erreur lors de l'abonnement:", error)
      state.error = "Impossible d'activer les notifications"

      toast.add({
        color: 'red',
        title: 'Erreur',
        description: state.error,
      })

      return false
    } finally {
      state.isLoading = false
    }
  }

  // Se désabonner des notifications push
  const unsubscribe = async () => {
    if (!state.isSubscribed || !state.subscription) {
      console.log("[Push] Pas d'abonnement à supprimer")
      return true
    }

    state.isLoading = true
    state.error = null

    try {
      // 1. Désabonner côté navigateur
      console.log('[Push] Unsubscribing...')
      await state.subscription.unsubscribe()

      // 2. Supprimer l'abonnement côté serveur
      await $fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        body: {
          endpoint: state.subscription.endpoint,
        },
      }).catch((err) => console.error('[Push] Erreur lors de la suppression côté serveur:', err))

      state.isSubscribed = false
      state.subscription = null

      toast.add({
        color: 'green',
        title: 'Notifications désactivées',
        description: 'Vous ne recevrez plus de notifications push',
      })

      console.log('[Push] Désabonnement réussi')
      return true
    } catch (error) {
      console.error('[Push] Erreur lors du désabonnement:', error)
      state.error = 'Impossible de désactiver les notifications'

      toast.add({
        color: 'red',
        title: 'Erreur',
        description: state.error,
      })

      return false
    } finally {
      state.isLoading = false
    }
  }

  // Fonction utilitaire pour convertir la clé VAPID
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Tester l'envoi d'une notification locale
  const testNotification = () => {
    if (!state.isSupported || state.permission !== 'granted') {
      toast.add({
        color: 'yellow',
        title: 'Non disponible',
        description: 'Les notifications ne sont pas activées',
      })
      return
    }

    const notification = new Notification('Test de notification', {
      body: 'Ceci est une notification de test',
      icon: '/favicons/android-chrome-192x192.png',
      badge: '/favicons/favicon-32x32.png',
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  // Initialisation
  onMounted(() => {
    checkSupport()
    if (state.isSupported) {
      checkSubscription()
    }
  })

  return {
    ...toRefs(state),
    subscribe,
    unsubscribe,
    testNotification,
    checkSupport,
    checkSubscription,
  }
}
