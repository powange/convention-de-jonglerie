export function useRealtimeStats(editionId: Ref<number> | number) {
  const isConnected = ref(false)
  const lastUpdate = ref<Date | null>(null)

  // Ne rien faire côté serveur
  if (import.meta.server) {
    return {
      isConnected,
      lastUpdate,
      reconnect: () => {},
    }
  }

  // Tout le code SSE est maintenant dans onMounted (client-only)
  const editionIdRef = ref(editionId)
  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000

  const connect = () => {
    // Construire l'URL SSE
    const sseUrl = `/api/editions/${editionIdRef.value}/ticketing/stats-sse`

    console.log('[SSE Client] Connecting to', sseUrl)

    try {
      eventSource = new EventSource(sseUrl)

      eventSource.onopen = () => {
        console.log('[SSE Client] Connected')
        isConnected.value = true
        reconnectAttempts = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[SSE Client] Message received:', data)

          if (
            data.type === 'entry-validated' ||
            data.type === 'entry-invalidated' ||
            data.type === 'stats-updated'
          ) {
            // Mettre à jour le timestamp pour déclencher un rafraîchissement
            lastUpdate.value = new Date()
          } else if (data.type === 'connected') {
            console.log('[SSE Client] Connection confirmed for edition', data.editionId)
          }
        } catch (error) {
          console.error('[SSE Client] Error parsing message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('[SSE Client] SSE error:', error)
        isConnected.value = false

        // EventSource se reconnecte automatiquement, mais on gère aussi manuellement
        // pour avoir plus de contrôle sur les tentatives
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          console.log('[SSE Client] Connection closed')
          disconnect()

          // Tentative de reconnexion
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            console.log(
              `[SSE Client] Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
            )
            reconnectTimeout = setTimeout(connect, RECONNECT_DELAY)
          } else {
            console.error('[SSE Client] Max reconnection attempts reached')
          }
        }
      }
    } catch (error) {
      console.error('[SSE Client] Error creating EventSource:', error)
    }
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (eventSource) {
      console.log('[SSE Client] Disconnecting')
      eventSource.close()
      eventSource = null
    }

    isConnected.value = false
  }

  // Initialiser uniquement côté client
  if (import.meta.client) {
    // Surveiller les changements d'editionId
    watch(editionIdRef, (newId, oldId) => {
      if (newId !== oldId) {
        console.log('[SSE Client] Edition changed, reconnecting')
        disconnect()
        connect()
      }
    })

    onMounted(() => {
      connect()
    })

    onUnmounted(() => {
      disconnect()
    })
  }

  return {
    isConnected,
    lastUpdate,
    reconnect: connect,
  }
}
