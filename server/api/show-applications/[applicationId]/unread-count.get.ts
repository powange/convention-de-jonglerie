import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireShowApplicationAccess } from '@@/server/utils/show-application-helpers'

/**
 * GET /api/show-applications/[applicationId]/unread-count
 * Retourne le nombre de messages non lus pour la conversation de cette candidature
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const { application } = await requireShowApplicationAccess(event, user.id)

    // Récupérer la conversation
    const conversation = await prisma.conversation.findUnique({
      where: { showApplicationId: application.id },
      select: {
        id: true,
        participants: {
          where: { userId: user.id, leftAt: null },
          select: { lastReadMessageId: true },
        },
        _count: { select: { messages: { where: { deletedAt: null } } } },
      },
    })

    if (!conversation) {
      return { success: true, unreadCount: 0, hasConversation: false }
    }

    const participant = conversation.participants[0]
    if (!participant) {
      return { success: true, unreadCount: 0, hasConversation: true }
    }

    // Compter les messages après le dernier lu
    let unreadCount = 0
    if (participant.lastReadMessageId) {
      const lastReadMessage = await prisma.message.findUnique({
        where: { id: participant.lastReadMessageId },
        select: { createdAt: true },
      })

      if (lastReadMessage) {
        unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            createdAt: { gt: lastReadMessage.createdAt },
            deletedAt: null,
          },
        })
      }
    } else {
      // Aucun message lu : tous les messages sont non lus
      unreadCount = conversation._count.messages
    }

    return { success: true, unreadCount, hasConversation: true }
  },
  { operationName: 'GetShowApplicationUnreadCount' }
)
