import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { messengerStreamService } from '@@/server/utils/messenger-unread-service'
import { z } from 'zod'

const typingSchema = z.object({
  isTyping: z.boolean(),
})

/**
 * POST /api/messenger/conversations/[conversationId]/typing
 * Broadcaster l'état de saisie d'un utilisateur dans une conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')

    if (!conversationId) {
      throw createError({
        statusCode: 400,
        message: 'ID de conversation manquant',
      })
    }

    const body = await readBody(event)
    const parse = typingSchema.safeParse(body)

    if (!parse.success) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
      })
    }

    const { isTyping } = parse.data

    // Vérifier que l'utilisateur est participant de cette conversation et récupérer les autres participants
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
        leftAt: null,
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: {
                leftAt: null,
                userId: {
                  not: user.id, // Tous les participants sauf l'utilisateur actuel
                },
              },
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!participant) {
      throw createError({
        statusCode: 403,
        message: 'Accès refusé',
      })
    }

    // Stocker l'état de typing en mémoire (pour compatibilité)
    setTypingState(user.id, conversationId, isTyping)

    // Envoyer l'événement de typing aux autres participants via SSE
    const otherParticipantIds = participant.conversation.participants.map((p) => p.userId)
    if (otherParticipantIds.length > 0) {
      messengerStreamService
        .sendTypingToUsers(otherParticipantIds, {
          conversationId,
          typingUserId: user.id,
          isTyping,
        })
        .catch((error) => {
          console.error("[Messenger] Erreur lors de l'envoi du typing SSE:", error)
        })
    }

    return { success: true, isTyping }
  },
  { operationName: 'BroadcastTypingStatus' }
)
