import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import type { Notification } from '~/stores/notifications'

interface SSEConnectionStats {
  isConnected: boolean
  isConnecting: boolean
  connectionId: string | null
  lastPing: Date | null
  reconnectAttempts: number
  error: string | null
}

export const useNotificationStream = () => {
  const notificationStore = useNotificationsStore()
  const authStore = useAuthStore()
  const toast = useToast()

  // État de la connexion SSE
  const connectionStats = ref<SSEConnectionStats>({
    isConnected: false,
    isConnecting: false,
    connectionId: null,
    lastPing: null,
    reconnectAttempts: 0,
    error: null,
  })

  // Instance EventSource
  let eventSource: EventSource | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  const maxReconnectAttempts = 5
  let reconnectDelay = 1000 // Start with 1 second

  /**
   * Établit la connexion SSE
   */
  const connect = async () => {
    // Ne pas se connecter si pas authentifié ou déjà en cours de connexion
    if (!authStore.user || connectionStats.value.isConnecting) {
      return
    }

    // Fermer une connexion existante
    if (eventSource) {
      disconnect()
    }

    connectionStats.value.isConnecting = true
    connectionStats.value.error = null

    try {
      console.log('[SSE Client] Tentative de connexion à /api/notifications/stream')
      eventSource = new EventSource('/api/notifications/stream')
      console.log('[SSE Client] EventSource créé, readyState:', eventSource.readyState)

      // Événement de connexion établie
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data)

        console.log('[SSE Client] ✅ Connexion SSE établie:', data.connectionId)
        connectionStats.value.isConnected = true
        connectionStats.value.isConnecting = false
        connectionStats.value.connectionId = data.connectionId
        connectionStats.value.reconnectAttempts = 0
        connectionStats.value.error = null
        reconnectDelay = 1000 // Reset delay
      })

      // Réception de nouvelles notifications
      eventSource.addEventListener('notification', (event) => {
        try {
          const notification: Notification = JSON.parse(event.data)

          // Ajouter la notification au store
          notificationStore.addRealTimeNotification(notification)

          // Toast de notification si l'utilisateur n'est pas sur la page notifications
          if (!window.location.pathname.includes('/notifications')) {
            toast.add({
              color: getNotificationColor(notification.type),
              title: notification.title,
              description: notification.message,
              timeout: 5000,
              actions: notification.actionUrl
                ? [
                    {
                      label: notification.actionText || 'Voir',
                      click: () => navigateTo(notification.actionUrl!),
                    },
                  ]
                : undefined,
            })
          }
        } catch (error) {
          console.error('[SSE Client] Erreur parsing notification:', error)
        }
      })

      // Ping du serveur (heartbeat)
      eventSource.addEventListener('ping', () => {
        connectionStats.value.lastPing = new Date()
        // console.log('[SSE Client] Ping reçu')
      })

      // Gestion des erreurs
      eventSource.onerror = (error) => {
        console.error('[SSE Client] Erreur de connexion:', {
          readyState: eventSource?.readyState,
          error,
        })
        connectionStats.value.isConnected = false
        connectionStats.value.isConnecting = false
        connectionStats.value.error = 'Connection error'

        // Tentative de reconnexion automatique
        scheduleReconnect()
      }

      // Gestion de la fermeture
      eventSource.onclose = () => {
        connectionStats.value.isConnected = false
        connectionStats.value.isConnecting = false
      }
    } catch (error) {
      console.error('[SSE Client] Erreur lors de la connexion:', error)

      connectionStats.value.isConnecting = false
      connectionStats.value.error = 'Failed to connect'

      scheduleReconnect()
    }
  }

  /**
   * Programme une tentative de reconnexion
   */
  const scheduleReconnect = () => {
    if (connectionStats.value.reconnectAttempts >= maxReconnectAttempts) {
      connectionStats.value.error = 'Max reconnect attempts reached'
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectTimer = setTimeout(() => {
      connectionStats.value.reconnectAttempts++
      reconnectDelay = Math.min(reconnectDelay * 2, 30000) // Exponential backoff, max 30s
      connect()
    }, reconnectDelay)
  }

  /**
   * Ferme la connexion SSE
   */
  const disconnect = () => {
    console.log('[SSE Client] Déconnexion du stream')

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    connectionStats.value.isConnected = false
    connectionStats.value.isConnecting = false
    connectionStats.value.connectionId = null
    connectionStats.value.lastPing = null
    connectionStats.value.error = null
    connectionStats.value.reconnectAttempts = 0
  }

  /**
   * Reconnexion manuelle
   */
  const reconnect = () => {
    disconnect()
    connectionStats.value.reconnectAttempts = 0
    reconnectDelay = 1000
    connect()
  }

  /**
   * Utilitaire pour obtenir la couleur selon le type de notification
   */
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'success'
      case 'WARNING':
        return 'warning'
      case 'ERROR':
        return 'error'
      default:
        return 'info'
    }
  }

  /**
   * Gestion de la visibilité de la page
   */
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Page devient visible, reconnecter si nécessaire
      if (
        !connectionStats.value.isConnected &&
        !connectionStats.value.isConnecting &&
        authStore.user
      ) {
        console.log('[SSE Client] Page visible, reconnexion...')
        reconnect()
      }
    } else {
      // Page cachée, on garde la connexion mais on arrête les reconnexions
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
  }

  // Nettoyage lors de la destruction du composable
  const cleanup = () => {
    disconnect()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  return {
    // État
    connectionStats: readonly(connectionStats),
    isConnected: computed(() => connectionStats.value.isConnected),
    isConnecting: computed(() => connectionStats.value.isConnecting),

    // Actions
    connect,
    disconnect,
    reconnect,
    cleanup,
    handleVisibilityChange,
  }
}
