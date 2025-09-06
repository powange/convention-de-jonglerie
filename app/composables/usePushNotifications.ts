import type { Ref } from 'vue'

export interface PushSubscriptionStatus {
  id: string
  service: string
  userAgent: string | null
  createdAt: string
  endpoint: string
}

export interface PushStatusResponse {
  success: boolean
  subscriptions: PushSubscriptionStatus[]
  count: number
  hasActiveSubscriptions: boolean
}

export const usePushNotifications = () => {
  const isSupported = ref(false)
  const isSubscribed = ref(false)
  const isLoading = ref(false)
  const subscription: Ref<PushSubscription | null> = ref(null)
  const subscriptions: Ref<PushSubscriptionStatus[]> = ref([])
  const permission: Ref<NotificationPermission> = ref('default')

  const runtimeConfig = useRuntimeConfig()

  // Vérifier le support des notifications push
  const checkSupport = () => {
    if (import.meta.client) {
      isSupported.value = (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      )
      permission.value = Notification.permission
    }
  }

  // Récupérer le statut des subscriptions
  const fetchStatus = async () => {
    try {
      const response = await $fetch<PushStatusResponse>('/api/push/status')
      subscriptions.value = response.subscriptions
      isSubscribed.value = response.hasActiveSubscriptions

      // Vérifier si la subscription actuelle est toujours valide
      if (import.meta.client && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const currentSubscription = await registration.pushManager.getSubscription()
        subscription.value = currentSubscription

        if (currentSubscription && !response.hasActiveSubscriptions) {
          // La subscription locale existe mais pas côté serveur
          isSubscribed.value = false
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du statut push:', error)
    }
  }

  // Demander la permission
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported.value) return false

    try {
      const result = await Notification.requestPermission()
      permission.value = result
      return result === 'granted'
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error)
      return false
    }
  }

  // S'abonner aux notifications push
  const subscribe = async (): Promise<boolean> => {
    if (!isSupported.value) return false

    isLoading.value = true
    try {
      // Demander la permission si nécessaire
      if (permission.value !== 'granted') {
        const granted = await requestPermission()
        if (!granted) return false
      }

      // Obtenir le service worker
      const registration = await navigator.serviceWorker.ready

      // Créer la subscription
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(runtimeConfig.public.vapidPublicKey),
      })

      // Envoyer au serveur
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: {
          subscription: pushSubscription.toJSON(),
        },
      })

      subscription.value = pushSubscription
      isSubscribed.value = true
      
      // Rafraîchir le statut
      await fetchStatus()
      
      return true
    } catch (error) {
      console.error('Erreur lors de l\'abonnement push:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Se désabonner des notifications push
  const unsubscribe = async (subscriptionId?: string): Promise<boolean> => {
    isLoading.value = true
    try {
      if (subscriptionId) {
        // Désabonner une subscription spécifique
        await $fetch('/api/push/unsubscribe', {
          method: 'POST',
          body: { subscriptionId },
        })
      } else {
        // Désabonner la subscription actuelle
        if (subscription.value) {
          await subscription.value.unsubscribe()
          await $fetch('/api/push/unsubscribe', {
            method: 'POST',
            body: { endpoint: subscription.value.endpoint },
          })
        }
        subscription.value = null
        isSubscribed.value = false
      }

      // Rafraîchir le statut
      await fetchStatus()
      
      return true
    } catch (error) {
      console.error('Erreur lors du désabonnement push:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Envoyer une notification de test
  const sendTest = async (): Promise<boolean> => {
    try {
      await $fetch('/api/push/test', { method: 'POST' })
      return true
    } catch (error) {
      console.error('Erreur lors de l\'envoi du test:', error)
      return false
    }
  }

  // Utilitaire pour convertir VAPID key
  const urlB64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Enregistrer le service worker personnalisé pour les push
  const registerPushServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      // Enregistrer le service worker personnalisé pour les push
      const registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/',
      })
      console.log('✅ Service Worker Push enregistré:', registration)
      return registration
    } catch (error) {
      console.error('❌ Erreur d\'enregistrement du Service Worker Push:', error)
    }
  }

  // Initialisation
  onMounted(() => {
    checkSupport()
    if (isSupported.value) {
      // Enregistrer le service worker personnalisé
      registerPushServiceWorker()
      fetchStatus()
    }
  })

  return {
    // États
    isSupported: readonly(isSupported),
    isSubscribed: readonly(isSubscribed),
    isLoading: readonly(isLoading),
    permission: readonly(permission),
    subscriptions: readonly(subscriptions),
    
    // Actions
    subscribe,
    unsubscribe,
    sendTest,
    requestPermission,
    fetchStatus,
  }
}