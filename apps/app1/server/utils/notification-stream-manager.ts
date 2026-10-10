interface StreamWrapper {
  /**
   * Envoie un message, et dit s'il est PARTI.
   *
   * ⚠️ Il rendait `void`. Le flux attrapait l'erreur d'`enqueue` et retournait sans rien dire : le
   * gestionnaire ne voyait jamais d'échec, et tout ce qui dépendait de cette détection — le retrait
   * de la connexion, `lastPing`, `cleanupStaleConnections` — était inatteignable.
   *
   * `undefined` est toléré : un flux qui oublie de répondre est traité comme un succès, faute de
   * mieux — exactement comme avant. Seul un `false` explicite fait retirer la connexion.
   */
  push: (message: { event?: string; data: string }) => boolean | undefined
  /** Fermer le flux côté serveur, quand le gestionnaire retire la connexion. */
  close?: () => void
  onClosed: (callback: () => void) => void
}

/** Un `push` a réussi tant qu'il n'a pas explicitement dit non — l'absence de réponse compte. */
function aEtePousse(resultat: boolean | undefined): boolean {
  return resultat !== false
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

    /*
     * Fermer le flux, et pas seulement l'oublier.
     *
     * Retirer la connexion de ses Maps sans fermer le contrôleur laissait le client avec une
     * connexion que plus rien n'alimentait : il attendait son ping jusqu'à ce que son propre réseau
     * tranche. La fermeture est idempotente côté point d'API, donc l'appeler ici ne gêne pas le
     * chemin ordinaire — où c'est la requête qui s'est fermée la première.
     */
    try {
      connection.stream.close?.()
    } catch (error) {
      console.error(`[SSE] Erreur à la fermeture de ${connectionId}:`, error)
    }
  }

  /**
   * Envoie une notification à toutes les connexions d'un utilisateur
   */
  async notifyUser(userId: number, notification: any) {
    return this.sendEvent(userId, 'notification', notification)
  }

  /**
   * Envoie le compteur de messages non lus à un utilisateur
   */
  async sendMessengerUnreadCount(
    userId: number,
    data: { unreadCount: number; conversationCount: number }
  ) {
    return this.sendEvent(userId, 'messenger_unread', data)
  }

  /**
   * Envoie une notification de nouveau message à un utilisateur
   */
  async sendMessengerNewMessage(
    userId: number,
    data: {
      conversationId: string
      messageId: string
      content: string
      createdAt: Date
      senderId: number
      senderPseudo: string
    }
  ) {
    return this.sendEvent(userId, 'messenger_new_message', data)
  }

  /**
   * Envoie un message COMPLET à un utilisateur, à la forme que rend le GET des messages.
   *
   * À distinguer de `sendMessengerNewMessage`, qui l'accompagne et ne change pas : celui-là porte
   * un résumé — de quoi afficher une pastille et un aperçu partout dans l'application. Celui-ci
   * porte le message entier, pour que la conversation OUVERTE puisse l'insérer sans rien
   * redemander. Les deux partent ensemble, à deux usages différents.
   */
  async sendMessengerMessage(userId: number, data: unknown) {
    return this.sendEvent(userId, 'messenger_message', data)
  }

  /** Un message modifié ou supprimé, à la même forme. */
  async sendMessengerMessageUpdated(userId: number, data: unknown) {
    return this.sendEvent(userId, 'messenger_message_updated', data)
  }

  /**
   * Quelqu'un a lu jusqu'à tel message — l'indicateur « lu par ».
   *
   * `readerId` et non `userId` : le destinataire de l'événement est déjà le premier argument, et
   * deux champs nommés pareil pour des personnes différentes sont une confusion en attente.
   */
  async sendMessengerRead(
    userId: number,
    data: { conversationId: string; readerId: number; lastReadMessageId: string }
  ) {
    return this.sendEvent(userId, 'messenger_read', data)
  }

  /**
   * Envoie un événement de typing à un utilisateur
   */
  async sendMessengerTyping(
    userId: number,
    data: {
      conversationId: string
      typingUserId: number
      isTyping: boolean
    }
  ) {
    return this.sendEvent(userId, 'messenger_typing', data)
  }

  /**
   * Envoie un événement de présence à un utilisateur
   */
  async sendMessengerPresence(
    userId: number,
    data: {
      conversationId: string
      changedUserId: number
      isPresent: boolean
      presentUserIds: number[]
    }
  ) {
    return this.sendEvent(userId, 'messenger_presence', data)
  }

  /**
   * Envoie un événement générique à toutes les connexions d'un utilisateur
   */
  private async sendEvent(userId: number, eventName: string, data: any) {
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
        const pousse = connection.stream.push({
          event: eventName,
          data: JSON.stringify(data),
        })
        if (aEtePousse(pousse)) sentCount++
        else {
          console.log(`[SSE] Connexion ${connectionId} ne reçoit plus : retrait`)
          toRemove.push(connectionId)
        }
      } catch (error) {
        console.error(`[SSE] Erreur envoi ${eventName} à ${connectionId}:`, error)
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
        const pousse = connection.stream.push({
          event: 'ping',
          data: JSON.stringify({ timestamp: Date.now() }),
        })
        /*
         * ⚠️ `lastPing` N'AVANCE QUE SUR UN ENVOI RÉUSSI.
         *
         * Il était rafraîchi juste après le `push`, quoi qu'il advienne. C'est ce qui rendait
         * `cleanupStaleConnections` inutile : l'horodatage d'une connexion morte se mettait à jour
         * toutes les trente secondes, et le seuil de deux minutes n'était donc jamais franchi.
         */
        if (aEtePousse(pousse)) connection.lastPing = new Date()
        else {
          console.log(`[SSE] Ping refusé par ${connectionId} : retrait`)
          toRemove.push(connectionId)
        }
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

    /*
     * Fermer chaque flux avant d'oublier les Maps.
     *
     * Le commentaire d'avant disait « pas de close() sur notre wrapper », et c'était vrai : il n'en
     * avait pas. Les vider sans fermer laissait, à l'arrêt du serveur, autant de clients suspendus
     * sur une connexion qui ne répondrait plus jamais — ils attendaient leur délai de ping avant de
     * se reconnecter, alors qu'une fermeture propre les y envoie tout de suite.
     */
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.stream.close?.()
      } catch (error) {
        console.error(`[SSE] Erreur à la fermeture de ${connectionId}:`, error)
      }
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
    notificationStreamManager.destroy()
  })

  process.on('SIGTERM', () => {
    notificationStreamManager.destroy()
  })
}
