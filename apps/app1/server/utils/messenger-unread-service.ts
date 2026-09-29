import { notificationStreamManager } from './notification-stream-manager'

/**
 * Les messages non lus de chaque conversation d'un utilisateur, en UNE requête.
 *
 * Ce comptage se faisait par un `message.count` PAR participation, et le même code vivait en trois
 * endroits : ici, dans `GET /api/messenger/unread-count`, et dans la liste des conversations. Il est
 * de plus rejoué pour CHAQUE destinataire à chaque envoi de message (`messages/index.post.ts`) :
 * une conversation de dix personnes déclenchait dix comptages, chacun faisant autant de requêtes
 * que ses destinataires ont de conversations.
 *
 * Le SQL est écrit à la main parce que Prisma ne sait pas grouper un `count` par relation. Deux
 * points méritent d'être dits :
 *
 * - `m.participantId <> cp.id` exclut bien les messages de l'utilisateur lui-même, et pas seulement
 *   ceux d'une de ses participations : `ConversationParticipant` porte
 *   `@@unique([conversationId, userId])`, donc il n'a qu'une ligne par conversation. Quitter puis
 *   revenir remet `leftAt` à NULL sur cette ligne au lieu d'en créer une seconde ;
 * - une conversation SANS message non lu n'apparaît pas dans le résultat (c'est une jointure, pas
 *   une jointure externe). L'absence vaut donc zéro, ce que la `Map` rend naturellement — mais le
 *   NOMBRE de conversations doit être compté à part, il ne se déduit pas de la taille de la `Map`.
 *
 * @returns une `Map` indexée par `conversationId`, ne contenant que les conversations ayant au
 *   moins un message non lu
 */
export async function compterNonLusParConversation(userId: number): Promise<Map<string, number>> {
  const lignes = await prisma.$queryRaw<{ conversationId: string; nonLus: bigint | number }[]>`
    SELECT cp.conversationId AS conversationId, COUNT(m.id) AS nonLus
    FROM ConversationParticipant cp
    JOIN Message m
      ON m.conversationId = cp.conversationId
      AND m.deletedAt IS NULL
      AND m.participantId <> cp.id
      AND m.createdAt > COALESCE(cp.lastReadAt, '1970-01-01 00:00:00')
    WHERE cp.userId = ${userId} AND cp.leftAt IS NULL
    GROUP BY cp.conversationId
  `

  // `COUNT()` revient en `BigInt` sous MySQL : sans cette conversion, la valeur casse la
  // sérialisation JSON de la réponse.
  return new Map(lignes.map((ligne) => [ligne.conversationId, Number(ligne.nonLus)]))
}

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
   * Diffuse un message COMPLET aux participants d'une conversation.
   *
   * ⚠️ C'est ce qui remplace le sondage. Le flux par conversation interrogeait la base toutes les
   * cinq secondes, par connexion ouverte : trois requêtes, pour trouver le plus souvent rien. Un
   * message qui vient d'être écrit est pourtant connu de celui qui l'enregistre — il n'y a rien à
   * aller chercher, il suffit de le pousser.
   *
   * Les échecs sont rattrapés PAR destinataire : quelqu'un dont la connexion vient de se fermer ne
   * doit pas empêcher les autres de recevoir le message. C'est le même parti que le reste de ce
   * service.
   */
  async sendMessageToUsers(userIds: number[], message: unknown): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await notificationStreamManager.sendMessengerMessage(userId, message)
        } catch (error) {
          console.error(`[MessengerStream] Message non diffusé à ${userId} :`, error)
        }
      })
    )
  },

  /** Diffuse un message modifié ou supprimé. */
  async sendMessageUpdatedToUsers(userIds: number[], message: unknown): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await notificationStreamManager.sendMessengerMessageUpdated(userId, message)
        } catch (error) {
          console.error(`[MessengerStream] Modification non diffusée à ${userId} :`, error)
        }
      })
    )
  },

  /** Diffuse l'avancée de lecture de quelqu'un aux autres participants. */
  async sendReadToUsers(
    userIds: number[],
    data: { conversationId: string; readerId: number; lastReadMessageId: string }
  ): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await notificationStreamManager.sendMessengerRead(userId, data)
        } catch (error) {
          console.error(`[MessengerStream] Lecture non diffusée à ${userId} :`, error)
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

  /**
   * Envoie un événement de présence à un utilisateur
   */
  async sendPresenceToUser(
    userId: number,
    data: {
      conversationId: string
      changedUserId: number
      isPresent: boolean
      presentUserIds: number[]
    }
  ): Promise<boolean> {
    return notificationStreamManager.sendMessengerPresence(userId, data)
  },

  /**
   * Envoie un événement de présence à plusieurs utilisateurs
   */
  async sendPresenceToUsers(
    userIds: number[],
    data: {
      conversationId: string
      changedUserId: number
      isPresent: boolean
      presentUserIds: number[]
    }
  ): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await this.sendPresenceToUser(userId, data)
        } catch (error) {
          console.error(
            `[MessengerStream] Erreur lors de l'envoi de la présence à l'utilisateur ${userId}:`,
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
  async getUnreadCount(
    userId: number
  ): Promise<{ unreadCount: number; conversationCount: number }> {
    // Deux requêtes, quel que soit le nombre de conversations. Le compte des conversations se
    // demande à part : la `Map` ne contient que celles qui ont du non-lu.
    const [nonLusParConversation, conversationCount] = await Promise.all([
      compterNonLusParConversation(userId),
      prisma.conversationParticipant.count({ where: { userId, leftAt: null } }),
    ])

    let unreadCount = 0
    for (const nombre of nonLusParConversation.values()) {
      unreadCount += nombre
    }

    return { unreadCount, conversationCount }
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
