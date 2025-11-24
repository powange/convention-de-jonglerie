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

// Flag GLOBAL pour désactiver temporairement le reload sur controllerchange
// Doit être global pour persister entre les instances du composable
let globalAllowReloadOnControllerChange = true

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

      // Vérifier côté serveur si l'utilisateur a des notifications actives (VAPID ou FCM)
      try {
        const response = await $fetch('/api/notifications/push/check', {
          method: 'POST',
          body: {
            endpoint: subscription?.endpoint, // Peut être undefined si pas de subscription VAPID
          },
        })

        if (response.isActive) {
          state.isSubscribed = true
          state.subscription = subscription
          notificationStore.setRealTimeEnabled(true)
        } else {
          state.isSubscribed = false
          state.subscription = subscription
          // Si on a une subscription locale mais qu'elle n'est pas active côté serveur
          if (subscription && Notification.permission !== 'granted') {
            await subscription.unsubscribe().catch(console.error)
          }
        }
      } catch (error) {
        console.error('[Push] Erreur vérification serveur:', error)
        // En cas d'erreur, on considère la subscription comme inactive
        state.isSubscribed = false
        state.subscription = subscription
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
    console.log('[Push VAPID] 🚀 Début de subscribe()')

    if (!authStore.user) {
      toast.add({
        color: 'warning',
        title: 'Connexion requise',
        description: 'Vous devez être connecté pour activer les notifications',
      })
      return false
    }

    // Désactiver temporairement le reload automatique
    console.log('[Push VAPID] ⏸️ Désactivation du reload automatique')
    globalAllowReloadOnControllerChange = false

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

        console.log(
          '[Push] Tentative de souscription avec clé VAPID:',
          vapidPublicKey.substring(0, 20) + '...'
        )
        console.log('[Push] Service Worker état:', registration.active?.state)

        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
        console.log('[Push] ApplicationServerKey converti, longueur:', applicationServerKey.length)

        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey,
          })
          console.log('[Push] Souscription réussie!')
        } catch (subscribeError: any) {
          console.error('[Push] Erreur détaillée de souscription:', {
            name: subscribeError.name,
            message: subscribeError.message,
            code: subscribeError.code,
            stack: subscribeError.stack,
          })

          // Détecter si c'est Opera
          const isOpera =
            navigator.userAgent.indexOf('OPR') > -1 || navigator.userAgent.indexOf('Opera') > -1

          if (
            subscribeError.name === 'AbortError' &&
            subscribeError.message.includes('push service error')
          ) {
            if (isOpera) {
              console.warn('⚠️ Opera ne supporte pas le Push API correctement')
              toast.add({
                color: 'amber',
                title: 'Navigateur non compatible',
                description:
                  'Les notifications push ne sont pas supportées sur Opera. Utilisez Chrome, Edge ou Firefox.',
                icon: 'i-heroicons-exclamation-triangle',
                timeout: 8000,
              })
              throw new Error('Navigateur non compatible (Opera)')
            }
          }

          throw subscribeError
        }
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

      // Toast géré par le composant appelant
      console.log('[Push VAPID] ✅ Subscribe réussie, retour true')
      return true
    } catch (error: any) {
      console.error("[Push VAPID] ❌ Erreur lors de l'abonnement:", error)
      state.error = error?.message || "Impossible d'activer les notifications"

      toast.add({
        color: 'error',
        title: 'Erreur',
        description: state.error,
      })

      console.log('[Push VAPID] ❌ Subscribe échouée, retour false')
      return false
    } finally {
      state.isLoading = false
      // Réactiver le reload automatique après un délai
      console.log('[Push VAPID] 🔄 Réactivation du reload dans 2 secondes')
      setTimeout(() => {
        globalAllowReloadOnControllerChange = true
        console.log('[Push VAPID] ▶️ Reload automatique réactivé')
      }, 2000) // 2 secondes de délai
      console.log('[Push VAPID] 🏁 Fin de subscribe()')
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

      // Toast géré par le composant appelant
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
      badge: '/favicons/notification-badge.png',
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
          if (globalAllowReloadOnControllerChange) {
            console.log('[PushNotifications] Service Worker controller changed, reloading...')
            window.location.reload()
          } else {
            console.log(
              '[PushNotifications] Service Worker controller changed, but reload is disabled'
            )
          }
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
