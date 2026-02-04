import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { conversationPresenceService } from '#server/utils/conversation-presence-service'

/**
 * GET /api/messenger/conversations/[conversationId]/presence
 * Récupère la liste des utilisateurs présents sur une conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!

    // Vérifier que l'utilisateur est participant de cette conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
        leftAt: null,
      },
    })

    if (!participant) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Récupérer les IDs des utilisateurs présents
    const presentUserIds = conversationPresenceService.getPresentUsers(conversationId)

    return {
      success: true,
      data: {
        conversationId,
        presentUserIds,
        count: presentUserIds.length,
      },
    }
  },
  { operationName: 'GetConversationPresence' }
)
