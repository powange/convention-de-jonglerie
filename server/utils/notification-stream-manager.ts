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

    console.log(
      `[SSE] Nouvelle connexion pour user ${userId}. Total connexions: ${this.connections.size}`
    )

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

    console.log(
      `[SSE] Connexion supprimée pour user ${userId}. Total connexions: ${this.connections.size}`
    )
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

    console.log(`[SSE] Notification envoyée à ${sentCount} connexion(s) pour user ${userId}`)
    return sentCount > 0
  }

  /**
   * Envoie un ping à toutes les connexions pour maintenir la connexion
   */
  async pingConnections() {
    const toRemove: string[] = []
    let pingCount = 0

    for (const [connectionId, connection] of this.connections) {
      try {
        connection.stream.push({
          event: 'ping',
          data: JSON.stringify({ timestamp: Date.now() }),
        })
        connection.lastPing = new Date()
        pingCount++
      } catch (error) {
        console.error(`[SSE] Erreur ping connexion ${connectionId}:`, error)
        toRemove.push(connectionId)
      }
    }

    // Nettoyer les connexions mortes
    toRemove.forEach((id) => this.removeConnection(id))

    if (pingCount > 0) {
      console.log(`[SSE] Ping envoyé à ${pingCount} connexion(s)`)
    }
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
        console.log(`[SSE] Connexion stale détectée: ${connectionId}`)
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
    for (const [connectionId] of this.connections) {
      console.log(`[SSE] Nettoyage connexion ${connectionId}`)
    }

    this.connections.clear()
    this.userConnections.clear()
  }
}

// Instance globale partagée
export const notificationStreamManager = new NotificationStreamManager()

// Nettoyage gracieux lors de l'arrêt du serveur
if (process.env.NODE_ENV !== 'development') {
  process.on('SIGINT', () => {
    console.log('[SSE] Arrêt du gestionnaire de stream...')
    notificationStreamManager.destroy()
  })

  process.on('SIGTERM', () => {
    console.log('[SSE] Arrêt du gestionnaire de stream...')
    notificationStreamManager.destroy()
  })
}
