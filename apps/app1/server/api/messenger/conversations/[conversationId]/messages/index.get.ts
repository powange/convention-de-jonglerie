import { z } from 'zod'

import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { masquerMessageSupprime } from '#server/utils/messenger-message-affiche'
import { messengerMessageInclude } from '#server/utils/prisma-select-helpers'
import { checkArtistApplicationConversationAccess } from '#server/utils/show-application-helpers'
import { decalageDePagination, limiteDePagination } from '#server/utils/validation-schemas'

/**
 * Les bornes de la pagination, VALIDÉES — la règle et son pourquoi sont dans
 * `validation-schemas.ts`.
 *
 * Le plafond de 100 y est le double de ce que demandent les deux écrans qui appellent ce point
 * d'API : la messagerie et le fil d'une candidature chargent 50 messages à la fois.
 */
const querySchema = z.object({
  limit: limiteDePagination(),
  offset: decalageDePagination(),
})

/** Ce qu'on charge quand l'appelant ne demande rien — la valeur d'avant. */
const LIMITE_PAR_DEFAUT = 50

/**
 * GET /api/messenger/conversations/[conversationId]/messages
 * Récupère les messages d'une conversation avec pagination
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const query = getQuery(event)
    const { limit: limiteDemandee, offset: decalageDemande } = querySchema.parse(query)
    const limit = limiteDemandee ?? LIMITE_PAR_DEFAUT
    const offset = decalageDemande ?? 0

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
