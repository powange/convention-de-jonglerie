import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  messageId: z.string(),
})

/**
 * PATCH /api/messenger/conversations/[conversationId]/mark-read
 * Met à jour le lastReadMessageId d'une conversation pour l'utilisateur connecté
 * Utilisé pour marquer un message comme lu et détecter si l'utilisateur est actif sur la conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const body = await readBody(event)
    const { messageId } = bodySchema.parse(body)

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
        statusCode: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Vérifier que le message appartient bien à cette conversation
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deletedAt: null,
      },
    })

    if (!message) {
      throw createError({
        statusCode: 404,
        message: 'Message introuvable dans cette conversation',
      })
    }

    // Mettre à jour le lastReadMessageId
    await prisma.conversationParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        lastReadMessageId: messageId,
        lastReadAt: new Date(), // On garde aussi lastReadAt pour compatibilité
      },
    })

    return {
      success: true,
    }
  },
  { operationName: 'MarkConversationAsRead' }
)
