import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
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

    // Récupérer les messages (incluant les supprimés pour afficher "Message supprimé")
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      include: {
        participant: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                emailHash: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            deletedAt: true,
            participant: {
              select: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                  },
                },
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

    // Compter le total de messages (incluant les supprimés)
    const total = await prisma.message.count({
      where: {
        conversationId,
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

    // Transformer les messages pour supprimer participantId et masquer le contenu des messages supprimés
    const transformedMessages = messages.map((message) => {
      const { participantId: _participantId, ...messageWithoutParticipantId } = message

      // Remplacer le contenu par "Message supprimé" si le message est supprimé
      if (message.deletedAt) {
        return {
          ...messageWithoutParticipantId,
          content: 'Message supprimé',
          // Si le message auquel on répond est supprimé, le masquer aussi
          replyTo: message.replyTo
            ? {
                ...message.replyTo,
                content: message.replyTo.deletedAt ? 'Message supprimé' : message.replyTo.content,
              }
            : null,
        }
      }

      // Masquer le contenu du message replyTo s'il est supprimé
      return {
        ...messageWithoutParticipantId,
        replyTo: message.replyTo
          ? {
              ...message.replyTo,
              content: message.replyTo.deletedAt ? 'Message supprimé' : message.replyTo.content,
            }
          : null,
      }
    })

    return createPaginatedResponse(transformedMessages.reverse(), total, page, limit)
  },
  { operationName: 'GetConversationMessages' }
)
