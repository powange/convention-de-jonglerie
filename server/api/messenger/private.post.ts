import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { z } from 'zod'

const bodySchema = z.object({
  userId: z.number().int().positive(),
})

/**
 * POST /api/messenger/private
 * Crée ou récupère une conversation privée 1-à-1 avec un utilisateur
 */
export default wrapApiHandler(
  async (event) => {
    const currentUser = requireAuth(event)

    const body = await readBody(event)
    const { userId } = bodySchema.parse(body)

    // Vérifier qu'on ne crée pas une conversation avec soi-même
    if (userId === currentUser.id) {
      throw createError({
        statusCode: 400,
        message: 'Vous ne pouvez pas créer une conversation avec vous-même',
      })
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pseudo: true },
    })

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    // Chercher une conversation privée existante entre ces deux utilisateurs
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        type: 'PRIVATE',
        editionId: null,
        AND: [
          {
            participants: {
              some: {
                userId: currentUser.id,
                leftAt: null,
              },
            },
          },
          {
            participants: {
              some: {
                userId: userId,
                leftAt: null,
              },
            },
          },
        ],
      },
      include: {
        participants: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    })

    // Si une conversation existe avec exactement ces 2 participants, la retourner
    if (existingConversation && existingConversation.participants.length === 2) {
      return {
        success: true,
        data: {
          conversationId: existingConversation.id,
          created: false,
        },
      }
    }

    // Sinon, créer une nouvelle conversation
    const newConversation = await prisma.conversation.create({
      data: {
        type: 'PRIVATE',
        editionId: null,
        participants: {
          create: [{ userId: currentUser.id }, { userId: userId }],
        },
      },
    })

    return {
      success: true,
      data: {
        conversationId: newConversation.id,
        created: true,
      },
    }
  },
  { operationName: 'CreatePrivateConversation' }
)
