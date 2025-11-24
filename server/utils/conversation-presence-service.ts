/**
 * Service de gestion de présence dans les conversations
 * Permet de savoir en temps réel quels utilisateurs sont sur quelle conversation
 */

interface PresenceEntry {
  userId: number
  conversationId: string
  lastSeen: Date
}

class ConversationPresenceService {
  // Map: conversationId -> Set<userId>
  private presenceMap: Map<string, Set<number>> = new Map()

  // Map pour stocker les timeouts de nettoyage
  private cleanupTimeouts: Map<string, NodeJS.Timeout> = new Map()

  // Durée avant de considérer un utilisateur comme absent (en ms)
  private readonly PRESENCE_TIMEOUT = 15000 // 15 secondes

  /**
   * Marquer un utilisateur comme présent sur une conversation
   */
  markPresent(userId: number, conversationId: string): void {
    if (!this.presenceMap.has(conversationId)) {
      this.presenceMap.set(conversationId, new Set())
    }

    this.presenceMap.get(conversationId)!.add(userId)

    // Annuler le timeout de nettoyage existant
    const key = this.getKey(userId, conversationId)
    const existingTimeout = this.cleanupTimeouts.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Créer un nouveau timeout de nettoyage
    const timeout = setTimeout(() => {
      this.markAbsent(userId, conversationId)
    }, this.PRESENCE_TIMEOUT)

    this.cleanupTimeouts.set(key, timeout)

    console.log(
      `[Presence] Utilisateur ${userId} présent sur conversation ${conversationId} (${this.presenceMap.get(conversationId)?.size} présent(s))`
    )
  }

  /**
   * Marquer un utilisateur comme absent d'une conversation
   */
  markAbsent(userId: number, conversationId: string): void {
    const users = this.presenceMap.get(conversationId)
    if (users) {
      users.delete(userId)
      if (users.size === 0) {
        this.presenceMap.delete(conversationId)
      }
    }

    // Nettoyer le timeout
    const key = this.getKey(userId, conversationId)
    const timeout = this.cleanupTimeouts.get(key)
    if (timeout) {
      clearTimeout(timeout)
      this.cleanupTimeouts.delete(key)
    }

    console.log(
      `[Presence] Utilisateur ${userId} absent de conversation ${conversationId} (${users?.size || 0} présent(s))`
    )
  }

  /**
   * Vérifier si un utilisateur est présent sur une conversation
   */
  isPresent(userId: number, conversationId: string): boolean {
    return this.presenceMap.get(conversationId)?.has(userId) || false
  }

  /**
   * Obtenir tous les utilisateurs présents sur une conversation
   */
  getPresentUsers(conversationId: string): number[] {
    return Array.from(this.presenceMap.get(conversationId) || [])
  }

  /**
   * Obtenir le nombre d'utilisateurs présents sur une conversation
   */
  getPresenceCount(conversationId: string): number {
    return this.presenceMap.get(conversationId)?.size || 0
  }

  /**
   * Nettoyer toutes les présences d'un utilisateur (déconnexion globale)
   */
  cleanupUser(userId: number): void {
    for (const [conversationId, users] of this.presenceMap.entries()) {
      if (users.has(userId)) {
        this.markAbsent(userId, conversationId)
      }
    }
  }

  /**
   * Obtenir les statistiques de présence
   */
  getStats() {
    const totalConversations = this.presenceMap.size
    const totalUsers = new Set(
      Array.from(this.presenceMap.values()).flatMap((users) => Array.from(users))
    ).size

    return {
      totalConversations,
      totalUsers,
      conversations: Array.from(this.presenceMap.entries()).map(([conversationId, users]) => ({
        conversationId,
        userCount: users.size,
        users: Array.from(users),
      })),
    }
  }

  /**
   * Générer une clé unique pour userId + conversationId
   */
  private getKey(userId: number, conversationId: string): string {
    return `${userId}:${conversationId}`
  }
}

// Exporter une instance unique
export const conversationPresenceService = new ConversationPresenceService()
