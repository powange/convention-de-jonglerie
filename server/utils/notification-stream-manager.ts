interface StreamWrapper {
  push: (message: { event?: string; data: string }) => void
  onClosed: (callback: () => void) => void
}

interface StreamConnection {
  userId: number
  stream: StreamWrapper
  connectedAt: Date
  lastPing: Date
}

/**
 * Gestionnaire global des connexions SSE pour les notifications
 */
class NotificationStreamManager {
  private connections = new Map<string, StreamConnection>()
  private userConnections = new Map<number, Set<string>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanup()
  }

  /**
   * Ajoute une nouvelle connexion SSE
   */
  addConnection(userId: number, stream: StreamWrapper): string {
    const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const connection: StreamConnection = {
      userId,
      stream,
      connectedAt: new Date(),
      lastPing: new Date(),
    }

    // Stocker la connexion
    this.connections.set(connectionId, connection)

    // Indexer par utilisateur
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(connectionId)

    return connectionId
  }

  /**
   * Supprime une connexion SSE
   */
  removeConnection(connectionId: string) {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const { userId } = connection

    // Supprimer de la map principale
    this.connections.delete(connectionId)

    // Supprimer de l'index utilisateur
    const userSet = this.userConnections.get(userId)
    if (userSet) {
      userSet.delete(connectionId)
      if (userSet.size === 0) {
        this.userConnections.delete(userId)
      }
    }
  }

  /**
   * Envoie une notification à toutes les connexions d'un utilisateur
   */
  async notifyUser(userId: number, notification: any) {
    const userConnectionIds = this.userConnections.get(userId)
    if (!userConnectionIds || userConnectionIds.size === 0) {
      return false // Aucune connexion active
    }

    let sentCount = 0
    const toRemove: string[] = []

    for (const connectionId of userConnectionIds) {
      const connection = this.connections.get(connectionId)
      if (!connection) {
        toRemove.push(connectionId)
        continue
      }

      try {
        connection.stream.push({
          event: 'notification',
          data: JSON.stringify(notification),
        })
        sentCount++
      } catch (error) {
        console.error(`[SSE] Erreur envoi notification à ${connectionId}:`, error)
        toRemove.push(connectionId)
      }
    }

    // Nettoyer les connexions mortes
    toRemove.forEach((id) => this.removeConnection(id))

    return sentCount > 0
  }

  /**
   * Envoie un ping à toutes les connexions pour maintenir la connexion
   */
  async pingConnections() {
    const toRemove: string[] = []

    for (const [connectionId, connection] of this.connections) {
      try {
        connection.stream.push({
          event: 'ping',
          data: JSON.stringify({ timestamp: Date.now() }),
        })
        connection.lastPing = new Date()
      } catch (error) {
        console.error(`[SSE] Erreur ping connexion ${connectionId}:`, error)
        toRemove.push(connectionId)
      }
    }

    // Nettoyer les connexions mortes
    toRemove.forEach((id) => this.removeConnection(id))
  }

  /**
   * Nettoyage automatique des connexions inactives
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.pingConnections()
      this.cleanupStaleConnections()
    }, 30000) // Toutes les 30 secondes
  }

  /**
   * Supprime les connexions inactives depuis plus de 2 minutes
   */
  private cleanupStaleConnections() {
    const now = Date.now()
    const staleThreshold = 2 * 60 * 1000 // 2 minutes

    const toRemove: string[] = []

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastPing.getTime() > staleThreshold) {
        toRemove.push(connectionId)
      }
    }

    toRemove.forEach((id) => this.removeConnection(id))
  }

  /**
   * Statistiques des connexions
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      activeUsers: this.userConnections.size,
      connectionsByUser: Array.from(this.userConnections.entries()).map(
        ([userId, connections]) => ({
          userId,
          connections: connections.size,
        })
      ),
    }
  }

  /**
   * Nettoyage complet (à appeler lors de l'arrêt du serveur)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Nettoyer toutes les connexions (pas de close() sur notre wrapper)
    // Nettoyer toutes les connexions

    this.connections.clear()
    this.userConnections.clear()
  }
}

// Instance globale partagée
export const notificationStreamManager = new NotificationStreamManager()

// Nettoyage gracieux lors de l'arrêt du serveur
if (process.env.NODE_ENV !== 'development') {
  process.on('SIGINT', () => {
    notificationStreamManager.destroy()
  })

  process.on('SIGTERM', () => {
    notificationStreamManager.destroy()
  })
}
