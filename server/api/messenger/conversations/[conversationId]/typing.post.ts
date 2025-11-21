import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
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
        message: 'Accès refusé',
      })
    }

    // Stocker l'état de typing en mémoire
    setTypingState(user.id, conversationId, isTyping)

    return { success: true, isTyping }
  },
  { operationName: 'BroadcastTypingStatus' }
)
