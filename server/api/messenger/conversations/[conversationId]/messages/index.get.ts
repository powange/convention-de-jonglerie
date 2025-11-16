import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
})

/**
 * GET /api/messenger/conversations/[conversationId]/messages
 * Récupère les messages d'une conversation avec pagination
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const query = getQuery(event)
    const { limit, offset } = querySchema.parse(query)

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

    // Récupérer les messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      include: {
        participant: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    })

    // Compter le total de messages
    const total = await prisma.message.count({
      where: {
        conversationId,
        deletedAt: null,
      },
    })

    // Mettre à jour le lastReadAt du participant
    await prisma.conversationParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    })

    const page = Math.floor(offset / limit) + 1

    return createPaginatedResponse(messages.reverse(), total, page, limit)
  },
  { operationName: 'GetConversationMessages' }
)
