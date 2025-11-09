import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'

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
  const notificationStore = useNotificationsStore()
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

      if (state.isSupported) {
        state.permission = Notification.permission
      }
    }
  }

  // Enregistrer le Service Worker
  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!state.isSupported) {
      return null
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Ne pas utiliser le cache pour le SW
      })

      // Si un nouveau SW est en attente, le forcer à s'activer
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Vérifier les mises à jour
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        }
      })

      // Attendre que le Service Worker soit prêt
      await navigator.serviceWorker.ready

      // S'assurer que le SW est activé
      if (registration.installing || registration.waiting) {
        await new Promise<void>((resolve) => {
          const worker = registration.installing || registration.waiting
          if (worker) {
            worker.addEventListener('statechange', function handler() {
              if (worker.state === 'activated') {
                worker.removeEventListener('statechange', handler)
                resolve()
              }
            })
          } else {
            resolve()
          }
        })
      }

      return registration
    } catch (error) {
      console.error("[Push] Erreur lors de l'enregistrement du Service Worker:", error)
      state.error = "Impossible d'enregistrer le Service Worker"
      return null
    }
  }

  // Vérifier si l'utilisateur est déjà abonné
  const checkSubscription = async () => {
    if (!state.isSupported) {
      return
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()

      if (registrations.length === 0) {
        const registration = await registerServiceWorker()
        if (!registration) {
          state.isSubscribed = false
          state.subscription = null
          return
        }
      }

      const registration = (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service Worker timeout après 10s')), 10000)
        ),
      ])) as ServiceWorkerRegistration

      const subscription = await registration.pushManager.getSubscription()

      // Si on a une subscription ET la permission est accordée
      if (subscription && Notification.permission === 'granted') {
        // Vérifier côté serveur si la subscription est toujours active
        try {
          const response = await $fetch('/api/notifications/push/check', {
            method: 'POST',
            body: {
              endpoint: subscription.endpoint,
            },
          })

          if (response.isActive) {
            state.isSubscribed = true
            state.subscription = subscription
            notificationStore.setRealTimeEnabled(true)
          } else {
            state.isSubscribed = false
            state.subscription = subscription
          }
        } catch (error) {
          console.error('[Push] Erreur vérification serveur:', error)
          // En cas d'erreur, on considère la subscription comme inactive
          state.isSubscribed = false
          state.subscription = subscription
        }
      } else {
        // Si pas de subscription OU permission non accordée, pas d'abonnement valide
        state.isSubscribed = false
        state.subscription = null

        if (subscription && Notification.permission !== 'granted') {
          await subscription.unsubscribe().catch(console.error)
        }
      }
    } catch (error) {
      console.error("[Push] Erreur lors de la vérification de l'abonnement:", error)
      state.isSubscribed = false
      state.subscription = null
    }
  }

  // Demander la permission
  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.add({
        color: 'error',
        title: 'Non supporté',
        description: 'Les notifications push ne sont pas supportées sur ce navigateur',
      })
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      state.permission = permission

      if (permission === 'granted') {
        return true
      } else if (permission === 'denied') {
        toast.add({
          color: 'error',
          title: 'Permission refusée',
          description:
            'Vous avez refusé les notifications. Vous pouvez les réactiver dans les paramètres du navigateur.',
        })
        return false
      } else {
        return false
      }
    } catch (error) {
      console.error('[Push Permission] Erreur lors de la demande de permission:', error)
      state.error = 'Erreur lors de la demande de permission'
      return false
    }
  }

  // S'abonner aux notifications push
  const subscribe = async () => {
    if (!authStore.user) {
      toast.add({
        color: 'warning',
        title: 'Connexion requise',
        description: 'Vous devez être connecté pour activer les notifications',
      })
      return false
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

      // 3. Vérifier si une subscription existe déjà
      let subscription = await registration.pushManager.getSubscription()

      // 4. Si pas de subscription, en créer une nouvelle
      if (!subscription) {
        const vapidPublicKey = config.public.vapidPublicKey

        if (!vapidPublicKey) {
          console.error('[Push] Clé VAPID manquante')
          throw new Error('Clé publique VAPID manquante')
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey,
        })
      }

      // 5. Envoyer au serveur
      await $fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        body: {
          subscription: subscription.toJSON(),
        },
      })

      // 6. Mettre à jour l'état
      state.isSubscribed = true
      state.subscription = subscription
      state.permission = Notification.permission

      notificationStore.setRealTimeEnabled(true)
      window.dispatchEvent(new CustomEvent('push-notifications-enabled'))

      toast.add({
        color: 'success',
        title: 'Notifications activées',
        description: 'Vous recevrez maintenant des notifications push',
      })
      return true
    } catch (error: any) {
      console.error("[Push] Erreur lors de l'abonnement:", error)
      state.error = error?.message || "Impossible d'activer les notifications"

      toast.add({
        color: 'error',
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
    if (!state.subscription) {
      return true
    }

    state.isLoading = true
    state.error = null

    try {
      await state.subscription.unsubscribe()

      await $fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        body: {
          endpoint: state.subscription.endpoint,
        },
      })

      state.isSubscribed = false
      notificationStore.setRealTimeEnabled(false)
      window.dispatchEvent(new CustomEvent('push-notifications-disabled'))

      toast.add({
        color: 'success',
        title: 'Notifications désactivées',
        description: 'Vous ne recevrez plus de notifications push',
      })
      return true
    } catch (error) {
      console.error('[Push] Erreur lors du désabonnement:', error)
      state.error = 'Impossible de désactiver les notifications'

      toast.add({
        color: 'error',
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
    if (!state.isSupported) {
      toast.add({
        color: 'warning',
        title: 'Non supporté',
        description: 'Les notifications push ne sont pas supportées',
      })
      return
    }

    const currentPermission = Notification.permission
    if (currentPermission !== 'granted') {
      toast.add({
        color: 'warning',
        title: 'Non disponible',
        description: `Permission: ${currentPermission}. Les notifications ne sont pas activées`,
      })
      return
    }
    const notification = new Notification('🎯 Test de notification', {
      body: 'Ceci est une notification de test locale',
      icon: '/favicons/android-chrome-192x192.png',
      badge: '/favicons/favicon-32x32.png',
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    toast.add({
      color: 'success',
      title: 'Test envoyé',
      description: 'Notification de test envoyée',
    })
  }

  const forceCheck = async () => {
    checkSupport()
    if (state.isSupported) {
      await checkSubscription()
    }
  }

  // Initialisation
  onMounted(() => {
    checkSupport()
    if (state.isSupported) {
      checkSubscription()

      // Écouter les changements de Service Worker
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })
      }
    }
  })

  return {
    ...toRefs(state),
    subscribe,
    unsubscribe,
    testNotification,
    checkSupport,
    checkSubscription,
    forceCheck,
  }
}
