import { messengerStreamService } from './messenger-unread-service'

/**
 * Service de gestion de présence dans les conversations
 * Permet de savoir en temps réel quels utilisateurs sont sur quelle conversation
 */

class ConversationPresenceService {
  /**
   * conversationId → (userId → nombre de flux OUVERTS pour cette personne).
   *
   * ## ⚠️ C'ÉTAIT UN `Set`, ET C'EST TOUT LE DÉFAUT
   *
   * Chaque flux SSE ouvert appelait `markPresent`, chaque fermeture `markAbsent`. Sans compteur,
   * deux onglets sur la même conversation — ou un téléphone et un ordinateur — se marchaient
   * dessus : fermer le premier retirait la personne de l'ensemble et diffusait « absent » aux
   * autres participants, alors que le second lisait toujours. La pastille verte et la liste des
   * présents devenaient fausses jusqu'à une nouvelle connexion.
   *
   * Un simple rechargement de page produisait le même symptôme en plus bref : fermeture puis
   * réouverture, donc un clignotement absent/présent diffusé à tout le monde.
   *
   * Compter les CONNEXIONS plutôt que les personnes rend les deux gestes symétriques : on ne
   * notifie qu'aux passages 0 → 1 et 1 → 0.
   */
  private presenceMap: Map<string, Map<number, number>> = new Map()

  // Map: conversationId -> Set<userId> pour les participants de la conversation (cache)
  private conversationParticipantsCache: Map<string, number[]> = new Map()

  /**
   * Marquer un utilisateur comme présent sur une conversation
   */
  markPresent(userId: number, conversationId: string): void {
    let connexions = this.presenceMap.get(conversationId)
    if (!connexions) {
      connexions = new Map()
      this.presenceMap.set(conversationId, connexions)
    }

    const avant = connexions.get(userId) ?? 0
    connexions.set(userId, avant + 1)

    // Notifier au seul passage 0 → 1 : un deuxième onglet n'est pas une arrivée.
    if (avant === 0) {
      console.log(
        `✅ [Presence] Utilisateur ${userId} rejoint conversation ${conversationId} (${connexions.size} présent(s))`
      )

      // Notifier les autres participants via SSE
      this.notifyPresenceChange(conversationId, userId, true)
    }
  }

  /**
   * Marquer un utilisateur comme absent d'une conversation
   *
   * Décrémente une connexion. Le départ n'est annoncé qu'à la DERNIÈRE : tant qu'un autre onglet
   * lit, la personne est présente.
   */
  markAbsent(userId: number, conversationId: string): void {
    this.retirerDesConnexions(userId, conversationId, 1)
  }

  /**
   * Retirer `combien` connexions — ou toutes, avec `Infinity`.
   *
   * Le départ n'est annoncé qu'au passage à zéro, et une seule fois : c'est le point unique par
   * lequel passent la fermeture d'un onglet et la déconnexion globale, pour qu'ils ne puissent pas
   * diverger.
   */
  private retirerDesConnexions(userId: number, conversationId: string, combien: number): void {
    const connexions = this.presenceMap.get(conversationId)
    const avant = connexions?.get(userId) ?? 0
    if (!connexions || avant === 0) return

    const reste = Math.max(0, avant - combien)
    if (reste === 0) connexions.delete(userId)
    else connexions.set(userId, reste)

    if (connexions.size === 0) this.presenceMap.delete(conversationId)

    // Logger et notifier uniquement au départ de la dernière connexion
    if (reste === 0) {
      console.log(
        `👋 [Presence] Utilisateur ${userId} quitte conversation ${conversationId} (${connexions.size} présent(s))`
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
    return (this.presenceMap.get(conversationId)?.get(userId) ?? 0) > 0
  }

  /**
   * Obtenir tous les utilisateurs présents sur une conversation
   */
  getPresentUsers(conversationId: string): number[] {
    return Array.from(this.presenceMap.get(conversationId)?.keys() ?? [])
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
    /*
     * Une déconnexion globale emporte TOUTES les connexions de la personne, pas une seule.
     * Décrémenter de 1 la laisserait présente avec un onglet fantôme qui ne se refermera jamais —
     * et plus rien, ensuite, ne viendrait corriger ce compte.
     *
     * La liste est copiée avant de la parcourir : le retrait supprime des entrées de la `Map`.
     */
    for (const conversationId of Array.from(this.presenceMap.keys())) {
      this.retirerDesConnexions(userId, conversationId, Infinity)
    }
  }

  /**
   * Obtenir les statistiques de présence
   */
  getStats() {
    const totalConversations = this.presenceMap.size
    const totalUsers = new Set(
      Array.from(this.presenceMap.values()).flatMap((connexions) => Array.from(connexions.keys()))
    ).size

    return {
      totalConversations,
      totalUsers,
      conversations: Array.from(this.presenceMap.entries()).map(([conversationId, connexions]) => ({
        conversationId,
        userCount: connexions.size,
        users: Array.from(connexions.keys()),
      })),
    }
  }
}

// Exporter une instance unique
export const conversationPresenceService = new ConversationPresenceService()
