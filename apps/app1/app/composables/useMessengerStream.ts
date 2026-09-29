import { useAuthStore } from '@@/app/stores/auth'

import type { ConversationMessage } from './useMessenger'

interface StreamStats {
  isConnected: boolean
  isConnecting: boolean
  lastPing: Date | null
  error: string | null
}

/**
 * Le temps réel d'une conversation ouverte.
 *
 * ⚠️ LES MESSAGES N'ARRIVENT PLUS PAR CE FLUX. Le point d'API `…/stream` sondait la base toutes les
 * cinq secondes, par connexion : nouveaux messages, messages modifiés, avancée de lecture de chaque
 * autre participant. Ils sont désormais POUSSÉS par le flux global (`useNotificationStream`), que
 * l'application tient déjà ouvert pour ses pastilles — on y pioche ce qui concerne la conversation
 * regardée.
 *
 * Le flux par conversation reste ouvert, pour une seule raison : sa connexion EST le signal de
 * présence. L'ouvrir marque la personne présente sur la conversation, le fermer la marque absente.
 *
 * ⚠️ Le contrat rendu est INCHANGÉ — `realtimeMessages`, `messageUpdates`, `readReceipts`,
 * `clearMessages`, `clearMessageUpdates`. L'écran de la messagerie n'a pas à savoir par où passe
 * l'information, et c'est ce qui permet de changer le transport sans y toucher.
 *
 * `useNotificationStream` est un singleton (son état vit au niveau du module) : l'appeler ici
 * n'ouvre pas une seconde connexion.
 */
export const useMessengerStream = (conversationId: Ref<string | null>) => {
  const _toast = useToast()
  const authStore = useAuthStore()
  const { messengerMessages, messengerMessageUpdates, messengerReadReceipts } =
    useNotificationStream()

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

  // Accusés de lecture en temps réel : userId -> id du dernier message lu
  const readReceipts = ref<Record<number, string>>({})

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
      // Construire l'URL avec le paramètre adminMode si nécessaire (car EventSource ne supporte pas les headers)
      let url = `/api/messenger/conversations/${conversationId.value}/stream`
      if (authStore.isAdminModeActive) {
        url += '?adminMode=true'
      }
      if (import.meta.dev) {
        console.log('[Messenger SSE] Connexion à:', url)
      }

      eventSource = new EventSource(url)

      // Gestion de l'ouverture
      eventSource.onopen = () => {
        if (import.meta.dev) {
          console.log('[Messenger SSE] ✅ Connexion établie')
        }
        streamStats.value.isConnected = true
        streamStats.value.isConnecting = false
        reconnectAttempts = 0
        reconnectDelay = 2000
      }

      // Ce flux ne porte plus que le ping : il garde la connexion — donc la présence — vivante.
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ping') {
            streamStats.value.lastPing = new Date(data.timestamp)
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
      if (import.meta.dev) {
        console.log('[Messenger SSE] Déconnexion du stream')
      }
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

  /*
   * Ce qui arrive par le flux global et concerne CETTE conversation.
   *
   * Le tri lui-même vit dans `utils/evenements-messagerie.ts`, en fonctions pures : c'est la seule
   * vraie logique de ce composable, celle qui peut se tromper en silence, et elle s'éprouve là sans
   * Pinia, sans `EventSource` et sans flux ouvert.
   *
   * Les événements sont RETIRÉS de la file partagée au passage. Sans cela, changer de conversation
   * puis revenir rejouerait tout depuis le début de la session ; en retirer trop ferait disparaître
   * les messages des autres conversations avant leur ouverture.
   */
  const consommer = <T extends { conversationId: string }>(file: Ref<T[]>): T[] => {
    const { pourMoi, reste } = partagerParConversation(file.value, conversationId.value)
    if (pourMoi.length > 0) file.value = reste
    return pourMoi
  }

  watch(
    messengerMessages,
    () => {
      const nouveaux = messagesAbsents(
        consommer(messengerMessages) as unknown as ConversationMessage[],
        realtimeMessages.value
      )
      realtimeMessages.value.push(...nouveaux)
    },
    { deep: true }
  )

  watch(
    messengerMessageUpdates,
    () => {
      for (const message of consommer(messengerMessageUpdates)) {
        const modifie = message as unknown as ConversationMessage
        const rang = realtimeMessages.value.findIndex((m) => m.id === modifie.id)
        if (rang !== -1) realtimeMessages.value[rang] = modifie
        // Aussi dans `messageUpdates` : l'écran y traite les messages qui ne sont pas dans
        // `realtimeMessages` — ceux chargés par la pagination avant l'ouverture du flux.
        messageUpdates.value.push(modifie)
      }
    },
    { deep: true }
  )

  watch(
    [messengerReadReceipts, conversationId],
    () => {
      if (!conversationId.value) return
      const pourMoi = messengerReadReceipts.value.get(conversationId.value)
      if (pourMoi) readReceipts.value = { ...readReceipts.value, ...pourMoi }
    },
    { deep: true, immediate: true }
  )

  /**
   * Vide la liste des messages temps réel
   */
  const clearMessages = () => {
    realtimeMessages.value = []
    readReceipts.value = {}
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
    readReceipts: readonly(readReceipts),

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
