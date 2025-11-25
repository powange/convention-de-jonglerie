import { notificationStreamManager } from './notification-stream-manager'

interface NewMessageData {
  conversationId: string
  messageId: string
  content: string
  createdAt: Date
  senderId: number
  senderPseudo: string
}

/**
 * Service pour gérer les événements messenger via SSE
 */
export const messengerStreamService = {
  /**
   * Envoie une notification de nouveau message à un utilisateur
   */
  async sendNewMessageToUser(userId: number, data: NewMessageData): Promise<boolean> {
    return notificationStreamManager.sendMessengerNewMessage(userId, data)
  },

  /**
   * Envoie une notification de nouveau message à plusieurs utilisateurs
   */
  async sendNewMessageToUsers(userIds: number[], data: NewMessageData): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await this.sendNewMessageToUser(userId, data)
        } catch (error) {
          console.error(
            `[MessengerStream] Erreur lors de l'envoi du message à l'utilisateur ${userId}:`,
            error
          )
        }
      })
    )
  },

  /**
   * Envoie un événement de typing à un utilisateur
   */
  async sendTypingToUser(
    userId: number,
    data: { conversationId: string; typingUserId: number; isTyping: boolean }
  ): Promise<boolean> {
    return notificationStreamManager.sendMessengerTyping(userId, data)
  },

  /**
   * Envoie un événement de typing à plusieurs utilisateurs
   */
  async sendTypingToUsers(
    userIds: number[],
    data: { conversationId: string; typingUserId: number; isTyping: boolean }
  ): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await this.sendTypingToUser(userId, data)
        } catch (error) {
          console.error(
            `[MessengerStream] Erreur lors de l'envoi du typing à l'utilisateur ${userId}:`,
            error
          )
        }
      })
    )
  },
}

/**
 * Service pour gérer et envoyer les compteurs de messages non lus via SSE
 */
export const messengerUnreadService = {
  /**
   * Calcule le nombre de messages non lus pour un utilisateur
   */
  async getUnreadCount(userId: number): Promise<{ unreadCount: number; conversationCount: number }> {
    // Récupérer toutes les conversations où l'utilisateur est participant actif
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
      },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    })

    const conversationCount = participations.length

    if (conversationCount === 0) {
      return { unreadCount: 0, conversationCount: 0 }
    }

    // Compter les messages non lus pour chaque conversation
    let totalUnread = 0

    for (const participation of participations) {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: participation.conversationId,
          deletedAt: null,
          createdAt: {
            gt: participation.lastReadAt || new Date(0),
          },
          participant: {
            userId: {
              not: userId, // Ne pas compter ses propres messages
            },
          },
        },
      })
      totalUnread += unreadCount
    }

    return { unreadCount: totalUnread, conversationCount }
  },

  /**
   * Envoie le compteur de messages non lus à un utilisateur via SSE
   */
  async sendUnreadCountToUser(userId: number): Promise<boolean> {
    const data = await this.getUnreadCount(userId)
    return notificationStreamManager.sendMessengerUnreadCount(userId, data)
  },

  /**
   * Envoie le compteur de messages non lus à plusieurs utilisateurs via SSE
   * Utile pour notifier tous les participants d'une conversation
   */
  async sendUnreadCountToUsers(userIds: number[]): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await this.sendUnreadCountToUser(userId)
        } catch (error) {
          console.error(
            `[MessengerUnread] Erreur lors de l'envoi du compteur à l'utilisateur ${userId}:`,
            error
          )
        }
      })
    )
  },
}
