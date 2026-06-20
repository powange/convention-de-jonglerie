import { messengerStreamService } from './messenger-unread-service'

/**
 * Service de gestion de présence dans les conversations
 * Permet de savoir en temps réel quels utilisateurs sont sur quelle conversation
 */

class ConversationPresenceService {
  // Map: conversationId -> Set<userId>
  private presenceMap: Map<string, Set<number>> = new Map()

  // Map: conversationId -> Set<userId> pour les participants de la conversation (cache)
  private conversationParticipantsCache: Map<string, number[]> = new Map()

  /**
   * Marquer un utilisateur comme présent sur une conversation
   */
  markPresent(userId: number, conversationId: string): void {
    // Vérifier si l'utilisateur était déjà présent (pour les logs)
    const wasPresent = this.isPresent(userId, conversationId)

    if (!this.presenceMap.has(conversationId)) {
      this.presenceMap.set(conversationId, new Set())
    }

    this.presenceMap.get(conversationId)!.add(userId)

    // Logger et notifier uniquement si c'est un nouveau présent (pas un refresh)
    if (!wasPresent) {
      console.log(
        `✅ [Presence] Utilisateur ${userId} rejoint conversation ${conversationId} (${this.presenceMap.get(conversationId)?.size} présent(s))`
      )

      // Notifier les autres participants via SSE
      this.notifyPresenceChange(conversationId, userId, true)
    }
  }

  /**
   * Marquer un utilisateur comme absent d'une conversation
   */
  markAbsent(userId: number, conversationId: string): void {
    const users = this.presenceMap.get(conversationId)
    const wasPresent = users?.has(userId) || false

    if (users) {
      users.delete(userId)
      if (users.size === 0) {
        this.presenceMap.delete(conversationId)
      }
    }

    // Logger et notifier uniquement si l'utilisateur était effectivement présent
    if (wasPresent) {
      console.log(
        `👋 [Presence] Utilisateur ${userId} quitte conversation ${conversationId} (${users?.size || 0} présent(s))`
      )

      // Notifier les autres participants via SSE
      this.notifyPresenceChange(conversationId, userId, false)
    }
  }

  /**
   * Notifie les autres participants d'un changement de présence
   */
  private async notifyPresenceChange(
    conversationId: string,
    changedUserId: number,
    isPresent: boolean
  ): Promise<void> {
    try {
      // Récupérer les participants de la conversation depuis le cache ou la DB
      let participantIds = this.conversationParticipantsCache.get(conversationId)

      if (!participantIds) {
        // Charger depuis la DB et mettre en cache
        const participants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            leftAt: null,
          },
          select: {
            userId: true,
          },
        })
        participantIds = participants.map((p) => p.userId)
        this.conversationParticipantsCache.set(conversationId, participantIds)

        // Expirer le cache après 5 minutes
        setTimeout(
          () => {
            this.conversationParticipantsCache.delete(conversationId)
          },
          5 * 60 * 1000
        )
      }

      // Notifier tous les participants sauf celui qui a changé
      const otherParticipantIds = participantIds.filter((id) => id !== changedUserId)

      if (otherParticipantIds.length > 0) {
        const presentUserIds = this.getPresentUsers(conversationId)

        messengerStreamService
          .sendPresenceToUsers(otherParticipantIds, {
            conversationId,
            changedUserId,
            isPresent,
            presentUserIds,
          })
          .catch((error) => {
            console.error('[Presence] Erreur lors de la notification SSE:', error)
          })
      }
    } catch (error) {
      console.error('[Presence] Erreur lors de la notification de présence:', error)
    }
  }

  /**
   * Invalide le cache des participants d'une conversation
   */
  invalidateParticipantsCache(conversationId: string): void {
    this.conversationParticipantsCache.delete(conversationId)
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
}

// Exporter une instance unique
export const conversationPresenceService = new ConversationPresenceService()
