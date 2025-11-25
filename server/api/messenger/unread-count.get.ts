import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

/**
 * GET /api/messenger/unread-count
 * Retourne le nombre total de messages non lus pour l'utilisateur connecté
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Récupérer toutes les conversations où l'utilisateur est participant actif
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    })

    if (participations.length === 0) {
      return {
        success: true,
        data: { unreadCount: 0 },
      }
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
              not: user.id, // Ne pas compter ses propres messages
            },
          },
        },
      })
      totalUnread += unreadCount
    }

    return {
      success: true,
      data: { unreadCount: totalUnread },
    }
  },
  { operationName: 'GetMessengerUnreadCount' }
)
