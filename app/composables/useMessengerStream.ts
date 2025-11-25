import type { ConversationMessage } from './useMessenger'

interface StreamStats {
  isConnected: boolean
  isConnecting: boolean
  lastPing: Date | null
  error: string | null
}

/**
 * Composable pour gérer le stream SSE des messages en temps réel pour une conversation spécifique
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

  // Messages mis à jour (suppression ou modification)
  const messageUpdates = ref<ConversationMessage[]>([])

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
          } else if (data.type === 'message-updated') {
            // Mettre à jour un message existant (suppression ou modification)
            const messageId = data.data.id
            const messageIndex = realtimeMessages.value.findIndex((m) => m.id === messageId)

            if (messageIndex !== -1) {
              // Remplacer le message par la version mise à jour
              realtimeMessages.value[messageIndex] = data.data
            }

            // Ajouter à la liste des mises à jour pour que la page puisse gérer
            // les messages qui ne sont pas dans realtimeMessages
            messageUpdates.value.push(data.data)
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

  /**
   * Vide la liste des mises à jour de messages
   */
  const clearMessageUpdates = () => {
    messageUpdates.value = []
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
    messageUpdates: readonly(messageUpdates),

    // Actions
    connect,
    disconnect,
    clearMessages,
    clearMessageUpdates,
  }
}

// NOTE: Le composable useGlobalMessengerStream a été supprimé.
// Ses fonctionnalités (nouveaux messages, typing) sont maintenant gérées
// par useNotificationStream via le stream SSE de notifications unifié.
