import type { ConversationMessage } from './useMessenger'

interface StreamStats {
  isConnected: boolean
  isConnecting: boolean
  lastPing: Date | null
  error: string | null
}

interface GlobalMessageNotification {
  conversationId: string
  messageId: string
  content: string
  createdAt: Date
  participant: {
    user: {
      id: number
    }
  }
}

/**
 * Composable pour gérer le stream SSE des messages en temps réel
 */
export const useMessengerStream = (conversationId: Ref<string | null>) => {
  const _toast = useToast()

  // État de la connexion SSE
  const streamStats = ref<StreamStats>({
    isConnected: false,
    isConnecting: false,
    lastPing: null,
    error: null,
  })

  // Messages reçus en temps réel
  const realtimeMessages = ref<ConversationMessage[]>([])

  // Instance EventSource
  let eventSource: EventSource | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  const maxReconnectAttempts = 3
  let reconnectAttempts = 0
  let reconnectDelay = 2000

  /**
   * Établit la connexion SSE pour une conversation
   */
  const connect = () => {
    if (!conversationId.value || streamStats.value.isConnecting) {
      return
    }

    // Fermer une connexion existante
    if (eventSource) {
      disconnect()
    }

    streamStats.value.isConnecting = true
    streamStats.value.error = null

    try {
      const url = `/api/messenger/conversations/${conversationId.value}/stream`
      console.log('[Messenger SSE] Connexion à:', url)

      eventSource = new EventSource(url)

      // Gestion de l'ouverture
      eventSource.onopen = () => {
        console.log('[Messenger SSE] ✅ Connexion établie')
        streamStats.value.isConnected = true
        streamStats.value.isConnecting = false
        reconnectAttempts = 0
        reconnectDelay = 2000
      }

      // Réception des messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'ping') {
            streamStats.value.lastPing = new Date(data.timestamp)
          } else if (data.type === 'message') {
            // Ajouter le message à la liste
            realtimeMessages.value.push(data.data)
          }
        } catch (error) {
          console.error('[Messenger SSE] Erreur parsing event:', error)
        }
      }

      // Gestion des erreurs
      eventSource.onerror = (error) => {
        console.error('[Messenger SSE] Erreur de connexion:', error)
        streamStats.value.isConnected = false
        streamStats.value.isConnecting = false
        streamStats.value.error = 'Connection error'

        // Tentative de reconnexion automatique
        scheduleReconnect()
      }
    } catch (error) {
      console.error('[Messenger SSE] Erreur lors de la connexion:', error)
      streamStats.value.isConnecting = false
      streamStats.value.error = 'Failed to connect'
      scheduleReconnect()
    }
  }

  /**
   * Programme une tentative de reconnexion
   */
  const scheduleReconnect = () => {
    if (!conversationId.value) return

    if (reconnectAttempts >= maxReconnectAttempts) {
      streamStats.value.error = 'Max reconnect attempts reached'
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      reconnectDelay = Math.min(reconnectDelay * 2, 10000) // Max 10s
      connect()
    }, reconnectDelay)
  }

  /**
   * Ferme la connexion SSE
   */
  const disconnect = () => {
    if (eventSource) {
      console.log('[Messenger SSE] Déconnexion du stream')
      eventSource.close()
      eventSource = null
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    streamStats.value.isConnected = false
    streamStats.value.isConnecting = false
    streamStats.value.lastPing = null
    streamStats.value.error = null
    reconnectAttempts = 0
  }

  /**
   * Vide la liste des messages temps réel
   */
  const clearMessages = () => {
    realtimeMessages.value = []
  }

  // Surveiller les changements de conversationId
  watch(conversationId, (newId, oldId) => {
    if (oldId) {
      disconnect()
      clearMessages()
    }

    if (newId) {
      connect()
    }
  })

  // Nettoyage lors de la destruction
  onUnmounted(() => {
    disconnect()
  })

  return {
    // État
    streamStats: readonly(streamStats),
    isConnected: computed(() => streamStats.value.isConnected),
    isConnecting: computed(() => streamStats.value.isConnecting),
    realtimeMessages: readonly(realtimeMessages),

    // Actions
    connect,
    disconnect,
    clearMessages,
  }
}

/**
 * Composable pour écouter tous les nouveaux messages de l'utilisateur (stream global)
 * Permet de mettre à jour les compteurs de messages non lus en temps réel
 */
export const useGlobalMessengerStream = () => {
  const _toast = useToast()

  // Notifications de nouveaux messages
  const newMessageNotifications = ref<GlobalMessageNotification[]>([])

  // Instance EventSource
  let eventSource: EventSource | null = null
  const isConnected = ref(false)

  /**
   * Établit la connexion SSE globale
   */
  const connect = () => {
    if (eventSource || isConnected.value) {
      return
    }

    try {
      const url = '/api/messenger/stream'
      console.log('[Messenger Global SSE] Connexion à:', url)

      eventSource = new EventSource(url)

      // Gestion de l'ouverture
      eventSource.onopen = () => {
        console.log('[Messenger Global SSE] ✅ Connexion établie')
        isConnected.value = true
      }

      // Réception de tous les événements
      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'connected') {
            console.log(
              `[Messenger Global SSE] Connecté - ${message.conversationsCount} conversations`
            )
          } else if (message.type === 'new-message') {
            console.log('[Messenger Global SSE] Nouveau message reçu:', message.data)
            newMessageNotifications.value.push(message.data)
          } else if (message.type === 'ping') {
            // Ignorer les pings
          }
        } catch (error) {
          console.error('[Messenger Global SSE] Erreur parsing message:', error)
        }
      }

      // Gestion des erreurs
      eventSource.onerror = (error) => {
        console.error('[Messenger Global SSE] Erreur de connexion:', error)
        disconnect()
      }
    } catch (error) {
      console.error('[Messenger Global SSE] Erreur lors de la connexion:', error)
    }
  }

  /**
   * Ferme la connexion SSE globale
   */
  const disconnect = () => {
    if (eventSource) {
      console.log('[Messenger Global SSE] Déconnexion du stream')
      eventSource.close()
      eventSource = null
    }
    isConnected.value = false
  }

  /**
   * Vide les notifications
   */
  const clearNotifications = () => {
    newMessageNotifications.value = []
  }

  // Nettoyage lors de la destruction
  onUnmounted(() => {
    disconnect()
  })

  return {
    // État
    newMessageNotifications: readonly(newMessageNotifications),
    isConnected: readonly(isConnected),

    // Actions
    connect,
    disconnect,
    clearNotifications,
  }
}
