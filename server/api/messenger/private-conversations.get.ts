import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

/**
 * GET /api/messenger/private-conversations
 * Récupère les conversations privées 1-à-1 de l'utilisateur (non liées à une édition)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Récupérer les conversations privées de l'utilisateur
    const conversations = await prisma.conversation.findMany({
      where: {
        type: 'PRIVATE',
        editionId: null,
        participants: {
          some: {
            userId: user.id,
            leftAt: null, // Seulement les conversations actives
          },
        },
      },
      include: {
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
                emailHash: true,
              },
            },
          },
        },
        messages: {
          where: {
            deletedAt: null,
          },
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
  { operationName: 'GetPrivateConversations' }
)
