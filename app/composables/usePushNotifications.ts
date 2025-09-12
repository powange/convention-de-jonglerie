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

      if (state.isSupported) {
        state.permission = Notification.permission
        console.log('[Push] Support vérifié:', {
          isSupported: state.isSupported,
          permission: state.permission,
        })
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
    if (!state.isSupported) {
      console.log('[Push] Service non supporté, arrêt de checkSubscription')
      return
    }

    try {
      console.log('[Push] Vérification du Service Worker...')
      
      // Vérifier d'abord s'il y a des registrations
      const registrations = await navigator.serviceWorker.getRegistrations()
      console.log('[Push] Registrations trouvées:', registrations.length)
      
      if (registrations.length === 0) {
        console.log('[Push] Aucun Service Worker enregistré, tentative d\'enregistrement...')
        const registration = await registerServiceWorker()
        if (!registration) {
          console.error('[Push] Impossible d\'enregistrer le Service Worker')
          state.isSubscribed = false
          state.subscription = null
          return
        }
      }
      
      console.log('[Push] Attente du Service Worker...')
      
      // Utiliser un timeout pour éviter de bloquer indéfiniment
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service Worker timeout après 10s')), 10000)
        )
      ]) as ServiceWorkerRegistration
      
      console.log('[Push] Service Worker prêt, vérification subscription...')
      const subscription = await registration.pushManager.getSubscription()
      console.log('[Push] Subscription actuelle:', !!subscription)

      // Si on a une subscription ET la permission est accordée
      if (subscription && Notification.permission === 'granted') {
        state.isSubscribed = true
        state.subscription = subscription
        console.log('[Push] Abonnement valide existant trouvé')
      } else {
        // Si pas de subscription OU permission non accordée, pas d'abonnement valide
        state.isSubscribed = false
        state.subscription = null
        console.log("[Push] Pas d'abonnement valide:", {
          hasSubscription: !!subscription,
          permission: Notification.permission,
        })

        // Si on avait une subscription mais plus la permission, la désabonner
        if (subscription && Notification.permission !== 'granted') {
          console.log('[Push] Nettoyage de subscription obsolète')
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
      // Mettre à jour la permission après l'abonnement réussi
      state.permission = Notification.permission

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
    console.log('[Push Test] État actuel:', {
      isSupported: state.isSupported,
      permission: state.permission,
      isSubscribed: state.isSubscribed,
      currentPermission: Notification.permission,
    })

    if (!state.isSupported) {
      toast.add({
        color: 'yellow',
        title: 'Non supporté',
        description: 'Les notifications push ne sont pas supportées',
      })
      return
    }

    const currentPermission = Notification.permission
    if (currentPermission !== 'granted') {
      toast.add({
        color: 'yellow',
        title: 'Non disponible',
        description: `Permission: ${currentPermission}. Les notifications ne sont pas activées`,
      })
      return
    }

    console.log('[Push Test] Envoi de notification de test')
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
      color: 'green',
      title: 'Test envoyé',
      description: 'Notification de test envoyée',
    })
  }

  // Forcer une nouvelle vérification (utile pour debugging)
  const forceCheck = async () => {
    console.log('[Push] Force check demandé')
    checkSupport()
    if (state.isSupported) {
      console.log('[Push] Vérification des subscriptions...')
      await checkSubscription()
      console.log('[Push] État après vérification:', {
        isSubscribed: state.isSubscribed,
        permission: state.permission,
        hasSubscription: !!state.subscription,
      })
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
    forceCheck,
  }
}
