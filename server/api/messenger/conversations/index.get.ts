import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const querySchema = z.object({
  editionId: z.string().transform((val) => parseInt(val, 10)),
})

/**
 * GET /api/messenger/conversations?editionId=123
 * Récupère les conversations d'un utilisateur pour une édition donnée
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const query = getQuery(event)
    const { editionId } = querySchema.parse(query)

    // Vérifier que l'utilisateur a accès à cette édition (via ses candidatures de bénévole)
    const hasAccess = await prisma.editionVolunteerApplication.findFirst({
      where: {
        editionId,
        userId: user.id,
      },
    })

    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas accès aux conversations de cette édition",
      })
    }

    // Récupérer les conversations de l'utilisateur pour cette édition
    const conversations = await prisma.conversation.findMany({
      where: {
        editionId,
        participants: {
          some: {
            userId: user.id,
            leftAt: null, // Seulement les conversations actives
          },
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        participants: {
          where: {
            leftAt: null, // Seulement les participants actifs
          },
          select: {
            id: true,
            userId: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            participant: {
              select: {
                userId: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Calculer le nombre de messages non lus pour chaque conversation
    const conversationsWithUnreadCount = await Promise.all(
      conversations.map(async (conversation) => {
        const currentUserParticipant = conversation.participants.find((p) => p.userId === user.id)

        if (!currentUserParticipant) {
          return { ...conversation, unreadCount: 0 }
        }

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            deletedAt: null,
            createdAt: {
              gt: currentUserParticipant.lastReadAt || new Date(0),
            },
            participant: {
              userId: {
                not: user.id, // Ne pas compter ses propres messages
              },
            },
          },
        })

        return {
          ...conversation,
          unreadCount,
        }
      })
    )

    return {
      success: true,
      data: conversationsWithUnreadCount,
    }
  },
  { operationName: 'GetUserConversations' }
)
