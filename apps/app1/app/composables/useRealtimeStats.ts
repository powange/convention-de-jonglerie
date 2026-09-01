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

/**
 * Flux temps réel des statistiques de billetterie.
 *
 * @param actif Faut-il ouvrir le flux ? Par défaut oui, ce qui préserve les appelants existants.
 *   La page de contrôle d'accès, elle, n'est ouverte aux bénévoles que **pendant** leur créneau :
 *   hors créneau, le serveur refuse le flux, et le client réessayait cinq fois à trois secondes.
 *   Chaque visite laissait ainsi six 403 dans les journaux de production — trente-sept en quatre
 *   jours — pour une porte qu'on savait fermée avant de frapper.
 *
 *   Un refus d'autorisation ne se rattrape pas en attendant : mieux vaut ne pas ouvrir le flux que
 *   réessayer. Et `EventSource` n'expose pas le code HTTP à `onerror`, donc le client ne peut pas
 *   distinguer un refus d'une coupure réseau — la décision doit se prendre ici, où on la connaît.
 */
export function useRealtimeStats(
  editionId: Ref<number> | number,
  actif: Ref<boolean> | (() => boolean) = () => true
) {
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

  // Vérifier si une connexion existe déjà pour cette édition.
  //
  // On rend alors les mêmes refs sans rien ouvrir : le premier appelant s'en est chargé. Cela
  // suppose qu'il était autorisé — ce que garantit l'usage actuel, les composants qui partagent
  // ce flux n'étant montés que dans une page déjà accessible.
  if (sseConnections.has(editionIdValue)) {
    const existing = sseConnections.get(editionIdValue)!
    if (import.meta.dev) {
      console.log('[SSE Client] Reusing existing connection for edition', editionIdValue)
    }
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
      if (import.meta.dev) {
        console.log('[SSE Client] Already connected to edition', edId)
      }
      return
    }

    // Construire l'URL SSE avec le paramètre admin si nécessaire
    const authStore = useAuthStore()
    let sseUrl = `/api/editions/${edId}/ticketing/stats-sse`

    // Ajouter le query param adminMode si le mode admin est actif
    if (authStore.isAdminModeActive) {
      sseUrl += '?adminMode=true'
    }

    if (import.meta.dev) {
      console.log('[SSE Client] Connecting to', sseUrl)
    }

    try {
      connection.eventSource = new EventSource(sseUrl)

      connection.eventSource.onopen = () => {
        if (import.meta.dev) {
          console.log('[SSE Client] Connected')
        }
        connection.isConnected.value = true
        connection.reconnectAttempts = 0
      }

      connection.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (import.meta.dev) {
            console.log('[SSE Client] Message received:', data)
          }

          if (
            data.type === 'entry-validated' ||
            data.type === 'entry-invalidated' ||
            data.type === 'stats-updated'
          ) {
            // Mettre à jour le timestamp pour déclencher un rafraîchissement
            connection.lastUpdate.value = new Date()
          } else if (data.type === 'connected') {
            if (import.meta.dev) {
              console.log('[SSE Client] Connection confirmed for edition', data.editionId)
            }
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
          if (import.meta.dev) {
            console.log('[SSE Client] Connection closed')
          }
          disconnect(edId)

          // Tentative de reconnexion
          if (connection.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            connection.reconnectAttempts++
            if (import.meta.dev) {
              console.log(
                `[SSE Client] Reconnecting... (attempt ${connection.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
              )
            }
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
      if (import.meta.dev) {
        console.log('[SSE Client] Disconnecting')
      }
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
        if (import.meta.dev) {
          console.log('[SSE Client] Edition changed, reconnecting')
        }
        disconnect(oldId)
        connect(newId)
      }
    })

    // La condition d'activation devient vraie plus tard qu'au montage : elle dépend de l'édition
    // chargée et des droits, tous deux obtenus de façon asynchrone.
    watch(
      () => toValue(actif),
      (autorise) => {
        if (autorise) connect(editionIdValue)
        else disconnect(editionIdValue)
      },
      { immediate: true }
    )

    onUnmounted(() => {
      cleanup(editionIdValue)
    })
  }

  return {
    isConnected,
    lastUpdate,
    reconnect: () => {
      if (toValue(actif)) connect(editionIdValue)
    },
  }
}
