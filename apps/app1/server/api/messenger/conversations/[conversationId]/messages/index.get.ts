import { z } from 'zod'

import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { masquerMessageSupprime } from '#server/utils/messenger-message-affiche'
import { messengerMessageInclude } from '#server/utils/prisma-select-helpers'
import { checkArtistApplicationConversationAccess } from '#server/utils/show-application-helpers'

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

    // Si pas participant, vérifier l'accès spécial pour les conversations ARTIST_APPLICATION
    if (!participant) {
      await checkArtistApplicationConversationAccess(conversationId, user.id, event)
    }

    // Récupérer les messages (incluant les supprimés pour afficher "Message supprimé")
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      include: messengerMessageInclude,
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

    // Mettre à jour le lastReadAt du participant (seulement s'il est participant)
    if (participant) {
      await prisma.conversationParticipant.update({
        where: {
          id: participant.id,
        },
        data: {
          lastReadAt: new Date(),
        },
      })
    }

    const page = Math.floor(offset / limit) + 1

    const transformedMessages = messages.map((message) => masquerMessageSupprime(message))

    return createPaginatedResponse(transformedMessages.reverse(), total, page, limit)
  },
  { operationName: 'GetConversationMessages' }
)
