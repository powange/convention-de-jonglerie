import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

/**
 * GET /api/messenger/editions
 * Récupère la liste des éditions dans lesquelles l'utilisateur a des conversations
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Récupérer les éditions où l'utilisateur a des conversations actives
    const editionsWithConversations = await prisma.edition.findMany({
      where: {
        conversations: {
          some: {
            participants: {
              some: {
                userId: user.id,
                leftAt: null, // Seulement les conversations actives
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        convention: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            conversations: {
              where: {
                participants: {
                  some: {
                    userId: user.id,
                    leftAt: null,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    })

    return {
      success: true,
      data: editionsWithConversations,
    }
  },
  { operationName: 'GetMessengerEditions' }
)
