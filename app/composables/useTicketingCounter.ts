import { ref, computed, onBeforeUnmount } from 'vue'

interface Counter {
  id: number
  name: string
  token: string
  value: number
  editionId: number
  createdAt: string
  updatedAt: string
}

interface CounterUpdate {
  counterId: number
  value: number
  name: string
  updatedAt: string
}

interface PendingOperation {
  type: 'increment' | 'decrement' | 'reset'
  step?: number
  timestamp: number
  id: string
}

/**
 * Composable pour gérer un compteur de billetterie avec synchronisation temps réel
 * et support du mode hors-ligne avec file d'attente
 */
export function useTicketingCounter(editionId: number, token: string) {
  const counter = ref<Counter | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const activeConnections = ref(0)
  const isConnected = ref(false)
  const isUpdating = ref(false)
  const isSyncing = ref(false)
  const pendingOperations = ref<PendingOperation[]>([])
  const localValue = ref(0) // Valeur locale optimiste

  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  const _MAX_RECONNECT_DELAY = 30000 // 30 secondes (prévu pour usage futur)

  /**
   * Calcule la valeur affichée (valeur serveur + opérations en attente)
   */
  const displayValue = computed(() => {
    if (!counter.value) return localValue.value

    let value = counter.value.value
    // Appliquer les opérations en attente
    for (const op of pendingOperations.value) {
      if (op.type === 'increment') {
        value += op.step || 1
      } else if (op.type === 'decrement') {
        value -= op.step || 1
      } else if (op.type === 'reset') {
        value = 0
      }
    }
    return Math.max(0, value) // Ne jamais descendre sous 0
  })

  /**
   * Génère un ID unique pour une opération
   */
  const generateOperationId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Récupère les données du compteur
   */
  const fetchCounter = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; counter: Counter }>(
        `/api/editions/${editionId}/ticketing/counters/token/${token}`
      )
      counter.value = response.counter
      localValue.value = response.counter.value
    } catch (err: any) {
      error.value =
        err?.data?.message || err?.message || 'Erreur lors de la récupération du compteur'
      console.error('Error fetching counter:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Synchronise les opérations en attente avec le serveur
   */
  const syncPendingOperations = async () => {
    if (pendingOperations.value.length === 0 || isSyncing.value) return

    isSyncing.value = true
    const operations = [...pendingOperations.value]

    console.log(`[Counter] Synchronisation de ${operations.length} opération(s) en attente...`)

    for (const op of operations) {
      try {
        if (op.type === 'increment') {
          await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/increment`, {
            method: 'PATCH',
            body: { step: op.step || 1 },
          })
        } else if (op.type === 'decrement') {
          await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/decrement`, {
            method: 'PATCH',
            body: { step: op.step || 1 },
          })
        } else if (op.type === 'reset') {
          await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/reset`, {
            method: 'PATCH',
          })
        }

        // Retirer l'opération de la file d'attente
        pendingOperations.value = pendingOperations.value.filter((o) => o.id !== op.id)
      } catch (err) {
        console.error('[Counter] Erreur lors de la synchronisation:', err)
        // On garde les opérations en attente en cas d'échec
        break
      }
    }

    isSyncing.value = false
    console.log(
      `[Counter] Synchronisation terminée. ${pendingOperations.value.length} opération(s) restante(s)`
    )
  }

  /**
   * Se connecte au flux SSE pour les mises à jour en temps réel
   */
  const connectSSE = () => {
    if (eventSource) {
      eventSource.close()
    }

    const url = `/api/editions/${editionId}/ticketing/counters/token/${token}/stream`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data)
      isConnected.value = true
      activeConnections.value = data.activeConnections || 0
      console.log('[Counter SSE] Connecté:', data)

      // Synchroniser les opérations en attente dès la reconnexion
      if (pendingOperations.value.length > 0) {
        console.log(
          `[Counter SSE] Reconnexion détectée, ${pendingOperations.value.length} opération(s) à synchroniser`
        )
        syncPendingOperations()
      }
    })

    eventSource.addEventListener('counter-update', (event) => {
      const update: CounterUpdate = JSON.parse(event.data)
      if (counter.value && update.counterId === counter.value.id) {
        counter.value.value = update.value
        counter.value.updatedAt = update.updatedAt
      }
    })

    eventSource.addEventListener('ping', (event) => {
      const data = JSON.parse(event.data)
      activeConnections.value = data.activeConnections || 0
    })

    eventSource.onerror = (err) => {
      console.error('[Counter SSE] Erreur:', err)
      isConnected.value = false

      // Tentative de reconnexion
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }

      reconnectTimeout = setTimeout(() => {
        console.log('[Counter SSE] Tentative de reconnexion...')
        connectSSE()
      }, 5000)
    }
  }

  /**
   * Déconnecte le flux SSE
   */
  const disconnectSSE = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (eventSource) {
      console.log('[Counter SSE] Déconnexion explicite')
      eventSource.close()
      eventSource = null
      isConnected.value = false
    }
  }

  /**
   * Incrémente le compteur (avec support hors-ligne)
   */
  const increment = async (step: number = 1) => {
    if (!counter.value) return

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'increment',
      step,
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      pendingOperations.value.push(operation)
      localValue.value += step
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/increment`, {
        method: 'PATCH',
        body: { step },
      })
      // La mise à jour sera reçue via SSE
    } catch (err: any) {
      // En cas d'échec, mettre en attente
      console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      pendingOperations.value.push(operation)
      localValue.value += step
      error.value = err?.data?.message || err?.message || "Erreur lors de l'incrémentation"
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Décrémente le compteur (avec support hors-ligne)
   */
  const decrement = async (step: number = 1) => {
    if (!counter.value) return

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'decrement',
      step,
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      pendingOperations.value.push(operation)
      localValue.value = Math.max(0, localValue.value - step)
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/decrement`, {
        method: 'PATCH',
        body: { step },
      })
      // La mise à jour sera reçue via SSE
    } catch (err: any) {
      // En cas d'échec, mettre en attente
      console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      pendingOperations.value.push(operation)
      localValue.value = Math.max(0, localValue.value - step)
      error.value = err?.data?.message || err?.message || 'Erreur lors de la décrémentation'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Réinitialise le compteur à 0 (avec support hors-ligne)
   */
  const reset = async () => {
    if (!counter.value) return

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'reset',
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      pendingOperations.value.push(operation)
      localValue.value = 0
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/reset`, {
        method: 'PATCH',
      })
      // La mise à jour sera reçue via SSE
    } catch (err: any) {
      // En cas d'échec, mettre en attente
      console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      pendingOperations.value.push(operation)
      localValue.value = 0
      error.value = err?.data?.message || err?.message || 'Erreur lors de la réinitialisation'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Initialise le compteur (fetch + SSE)
   */
  const init = async () => {
    // Déconnecter toute connexion SSE existante avant d'en créer une nouvelle
    disconnectSSE()
    await fetchCounter()
    connectSSE()
  }

  // Nettoyage à la destruction du composant
  onBeforeUnmount(() => {
    disconnectSSE()
  })

  return {
    counter: computed(() => counter.value),
    displayValue: computed(() => displayValue.value), // Valeur affichée avec opérations en attente
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    activeConnections: computed(() => activeConnections.value),
    isConnected: computed(() => isConnected.value),
    isUpdating: computed(() => isUpdating.value),
    isSyncing: computed(() => isSyncing.value),
    pendingCount: computed(() => pendingOperations.value.length),
    fetchCounter,
    increment,
    decrement,
    reset,
    init,
    disconnect: disconnectSSE,
  }
}

/**
 * Composable pour gérer la liste des compteurs d'une édition
 */
export function useTicketingCountersList(editionId: number) {
  const counters = ref<Counter[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Récupère la liste des compteurs
   */
  const fetchCounters = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; counters: Counter[] }>(
        `/api/editions/${editionId}/ticketing/counters`
      )
      counters.value = response.counters
    } catch (err: any) {
      error.value =
        err?.data?.message || err?.message || 'Erreur lors de la récupération des compteurs'
      console.error('Error fetching counters:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Crée un nouveau compteur
   */
  const createCounter = async (name: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; counter: Counter }>(
        `/api/editions/${editionId}/ticketing/counters`,
        {
          method: 'POST',
          body: { name },
        }
      )
      counters.value.unshift(response.counter)
      return response.counter
    } catch (err: any) {
      error.value = err?.data?.message || err?.message || 'Erreur lors de la création du compteur'
      console.error('Error creating counter:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Supprime un compteur
   */
  const deleteCounter = async (counterId: number) => {
    loading.value = true
    error.value = null

    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/${counterId}`, {
        method: 'DELETE',
      })
      counters.value = counters.value.filter((c) => c.id !== counterId)
    } catch (err: any) {
      error.value =
        err?.data?.message || err?.message || 'Erreur lors de la suppression du compteur'
      console.error('Error deleting counter:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    counters: computed(() => counters.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchCounters,
    createCounter,
    deleteCounter,
  }
}
