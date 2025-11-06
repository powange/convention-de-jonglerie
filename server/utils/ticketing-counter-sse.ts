import type { TicketingCounter } from '@prisma/client'

/**
 * Interface pour les connexions SSE des compteurs
 */
interface CounterStreamConnection {
  push: (message: { event?: string; data: string }) => void
  onClosed: (callback: () => void) => void
}

/**
 * Gestionnaire de streams SSE pour les compteurs de billetterie
 * Permet la synchronisation en temps réel des compteurs entre plusieurs utilisateurs
 */
class CounterStreamManager {
  // Map: editionId -> counterId -> Set<connectionId>
  private connections: Map<number, Map<number, Set<string>>> = new Map()
  // Map: connectionId -> connection object
  private connectionObjects: Map<string, CounterStreamConnection> = new Map()
  private nextConnectionId = 1

  /**
   * Ajoute une connexion pour un compteur spécifique
   */
  addConnection(editionId: number, counterId: number, connection: CounterStreamConnection): string {
    const connectionId = `counter-${this.nextConnectionId++}`

    // Initialiser la structure si nécessaire
    if (!this.connections.has(editionId)) {
      this.connections.set(editionId, new Map())
    }
    const editionCounters = this.connections.get(editionId)!

    if (!editionCounters.has(counterId)) {
      editionCounters.set(counterId, new Set())
    }
    editionCounters.get(counterId)!.add(connectionId)

    this.connectionObjects.set(connectionId, connection)

    console.log(
      `[Counter SSE] Nouvelle connexion ${connectionId} pour counter ${counterId} (edition ${editionId})`
    )
    console.log(`[Counter SSE] Total connexions actives: ${this.connectionObjects.size}`)

    // Gérer la fermeture de la connexion
    connection.onClosed(() => {
      this.removeConnection(connectionId, editionId, counterId)
    })

    return connectionId
  }

  /**
   * Supprime une connexion
   */
  removeConnection(connectionId: string, editionId: number, counterId: number): void {
    this.connectionObjects.delete(connectionId)

    const editionCounters = this.connections.get(editionId)
    if (editionCounters) {
      const counterConnections = editionCounters.get(counterId)
      if (counterConnections) {
        counterConnections.delete(connectionId)

        // Nettoyer les structures vides
        if (counterConnections.size === 0) {
          editionCounters.delete(counterId)
        }
      }

      if (editionCounters.size === 0) {
        this.connections.delete(editionId)
      }
    }

    console.log(`[Counter SSE] Connexion ${connectionId} supprimée`)
    console.log(`[Counter SSE] Total connexions actives: ${this.connectionObjects.size}`)
  }

  /**
   * Diffuse une mise à jour de compteur à tous les clients connectés
   */
  broadcastUpdate(editionId: number, counterId: number, counter: TicketingCounter): void {
    const editionCounters = this.connections.get(editionId)
    if (!editionCounters) return

    const counterConnections = editionCounters.get(counterId)
    if (!counterConnections || counterConnections.size === 0) return

    const message = {
      event: 'counter-update',
      data: JSON.stringify({
        counterId: counter.id,
        value: counter.value,
        name: counter.name,
        updatedAt: counter.updatedAt.toISOString(),
      }),
    }

    let sentCount = 0
    counterConnections.forEach((connectionId) => {
      const connection = this.connectionObjects.get(connectionId)
      if (connection) {
        try {
          connection.push(message)
          sentCount++
        } catch (error) {
          console.error(`[Counter SSE] Erreur lors de l'envoi à ${connectionId}:`, error)
          this.removeConnection(connectionId, editionId, counterId)
        }
      }
    })

    console.log(
      `[Counter SSE] Mise à jour diffusée à ${sentCount} connexion(s) pour counter ${counterId}`
    )
  }

  /**
   * Obtient le nombre de connexions actives pour un compteur
   */
  getConnectionCount(editionId: number, counterId: number): number {
    const editionCounters = this.connections.get(editionId)
    if (!editionCounters) return 0

    const counterConnections = editionCounters.get(counterId)
    return counterConnections ? counterConnections.size : 0
  }
}

// Instance singleton
export const counterStreamManager = new CounterStreamManager()

/**
 * Ajoute une connexion SSE pour un compteur
 */
export function addCounterConnection(
  editionId: number,
  counterId: number,
  connection: CounterStreamConnection
): string {
  return counterStreamManager.addConnection(editionId, counterId, connection)
}

/**
 * Supprime une connexion SSE
 */
export function removeCounterConnection(
  editionId: number,
  counterId: number,
  connection: CounterStreamConnection
): void {
  // Trouver l'ID de connexion correspondant à cet objet
  // Pour simplifier, on peut itérer sur les connexions
  const editionCounters = counterStreamManager['connections'].get(editionId)
  if (editionCounters) {
    const counterConnections = editionCounters.get(counterId)
    if (counterConnections) {
      for (const connectionId of counterConnections) {
        const conn = counterStreamManager['connectionObjects'].get(connectionId)
        if (conn === connection) {
          counterStreamManager.removeConnection(connectionId, editionId, counterId)
          break
        }
      }
    }
  }
}

/**
 * Obtient le nombre de connexions actives pour un compteur
 */
export function getActiveCounterConnections(editionId: number, counterId: number): number {
  return counterStreamManager.getConnectionCount(editionId, counterId)
}

/**
 * Fonction helper pour diffuser une mise à jour de compteur
 */
export function broadcastCounterUpdate(
  editionId: number,
  counterId: number,
  counter: TicketingCounter
): void {
  counterStreamManager.broadcastUpdate(editionId, counterId, counter)
}

/**
 * Notifie une mise à jour de compteur (alias pour broadcastCounterUpdate)
 */
export function notifyCounterUpdate(
  editionId: number,
  counterId: number,
  value: number,
  updatedAt: string
): void {
  // Créer un objet compteur minimal pour la diffusion
  const counter = {
    id: counterId,
    value,
    updatedAt: new Date(updatedAt),
  } as TicketingCounter

  counterStreamManager.broadcastUpdate(editionId, counterId, counter)
}
