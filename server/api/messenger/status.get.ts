import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * GET /api/messenger/status
 * Retourne le statut de messagerie de l'utilisateur connecté
 * - Vérifie s'il a au moins une conversation active
 * - Compte le nombre total de messages non lus
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Récupérer toutes les participations actives de l'utilisateur
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      select: {
        id: true,
        conversationId: true,
        lastReadAt: true,
        conversation: {
          select: {
            messages: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    const hasConversations = participations.length > 0

    // Calculer le nombre de messages non lus
    let unreadCount = 0
    for (const participation of participations) {
      const lastReadAt = participation.lastReadAt

      if (!lastReadAt) {
        // Si jamais lu, tous les messages sont non lus
        unreadCount += participation.conversation.messages.length
      } else {
        // Compter les messages postés après le dernier message lu
        const unreadMessages = participation.conversation.messages.filter(
          (message) => new Date(message.createdAt) > new Date(lastReadAt)
        )
        unreadCount += unreadMessages.length
      }
    }

    return {
      hasConversations,
      unreadCount,
      conversationsCount: participations.length,
    }
  },
  { operationName: 'GetMessengerStatus' }
)
