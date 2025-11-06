// État global partagé pour éviter les connexions multiples
const sseConnections = new Map<
  number,
  {
    eventSource: EventSource | null
    reconnectTimeout: ReturnType<typeof setTimeout> | null
    reconnectAttempts: number
    isConnected: Ref<boolean>
    lastUpdate: Ref<Date | null>
  }
>()

export function useRealtimeStats(editionId: Ref<number> | number) {
  // Ne rien faire côté serveur
  if (import.meta.server) {
    return {
      isConnected: ref(false),
      lastUpdate: ref<Date | null>(null),
      reconnect: () => {},
    }
  }

  const editionIdRef = ref(editionId)
  const editionIdValue = editionIdRef.value

  // Vérifier si une connexion existe déjà pour cette édition
  if (sseConnections.has(editionIdValue)) {
    const existing = sseConnections.get(editionIdValue)!
    console.log('[SSE Client] Reusing existing connection for edition', editionIdValue)
    return {
      isConnected: existing.isConnected,
      lastUpdate: existing.lastUpdate,
      reconnect: () => connect(editionIdValue),
    }
  }

  // Créer une nouvelle connexion
  const isConnected = ref(false)
  const lastUpdate = ref<Date | null>(null)

  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000

  sseConnections.set(editionIdValue, {
    eventSource: null,
    reconnectTimeout: null,
    reconnectAttempts: 0,
    isConnected,
    lastUpdate,
  })

  const connect = (edId: number) => {
    const connection = sseConnections.get(edId)
    if (!connection) return

    // Si déjà connecté, ne rien faire
    if (connection.eventSource && connection.eventSource.readyState !== EventSource.CLOSED) {
      console.log('[SSE Client] Already connected to edition', edId)
      return
    }

    // Construire l'URL SSE avec le paramètre admin si nécessaire
    const authStore = useAuthStore()
    let sseUrl = `/api/editions/${edId}/ticketing/stats-sse`

    // Ajouter le query param adminMode si le mode admin est actif
    if (authStore.isAdminModeActive) {
      sseUrl += '?adminMode=true'
    }

    console.log('[SSE Client] Connecting to', sseUrl)

    try {
      connection.eventSource = new EventSource(sseUrl)

      connection.eventSource.onopen = () => {
        console.log('[SSE Client] Connected')
        connection.isConnected.value = true
        connection.reconnectAttempts = 0
      }

      connection.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[SSE Client] Message received:', data)

          if (
            data.type === 'entry-validated' ||
            data.type === 'entry-invalidated' ||
            data.type === 'stats-updated'
          ) {
            // Mettre à jour le timestamp pour déclencher un rafraîchissement
            connection.lastUpdate.value = new Date()
          } else if (data.type === 'connected') {
            console.log('[SSE Client] Connection confirmed for edition', data.editionId)
          }
        } catch (error) {
          console.error('[SSE Client] Error parsing message:', error)
        }
      }

      connection.eventSource.onerror = (error) => {
        console.error('[SSE Client] SSE error:', error)
        connection.isConnected.value = false

        // EventSource se reconnecte automatiquement, mais on gère aussi manuellement
        // pour avoir plus de contrôle sur les tentatives
        if (connection.eventSource && connection.eventSource.readyState === EventSource.CLOSED) {
          console.log('[SSE Client] Connection closed')
          disconnect(edId)

          // Tentative de reconnexion
          if (connection.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            connection.reconnectAttempts++
            console.log(
              `[SSE Client] Reconnecting... (attempt ${connection.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
            )
            connection.reconnectTimeout = setTimeout(() => connect(edId), RECONNECT_DELAY)
          } else {
            console.error('[SSE Client] Max reconnection attempts reached')
          }
        }
      }
    } catch (error) {
      console.error('[SSE Client] Error creating EventSource:', error)
    }
  }

  const disconnect = (edId: number) => {
    const connection = sseConnections.get(edId)
    if (!connection) return

    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout)
      connection.reconnectTimeout = null
    }

    if (connection.eventSource) {
      console.log('[SSE Client] Disconnecting')
      connection.eventSource.close()
      connection.eventSource = null
    }

    connection.isConnected.value = false
  }

  const cleanup = (edId: number) => {
    disconnect(edId)
    sseConnections.delete(edId)
  }

  // Initialiser uniquement côté client
  if (import.meta.client) {
    // Surveiller les changements d'editionId
    watch(editionIdRef, (newId, oldId) => {
      if (newId !== oldId) {
        console.log('[SSE Client] Edition changed, reconnecting')
        disconnect(oldId)
        connect(newId)
      }
    })

    onMounted(() => {
      connect(editionIdValue)
    })

    onUnmounted(() => {
      cleanup(editionIdValue)
    })
  }

  return {
    isConnected,
    lastUpdate,
    reconnect: () => connect(editionIdValue),
  }
}
