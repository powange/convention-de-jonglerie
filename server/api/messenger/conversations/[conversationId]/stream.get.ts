import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

/**
 * GET /api/messenger/conversations/[conversationId]/stream
 * Stream SSE pour recevoir les nouveaux messages en temps réel
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!

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

    // Configurer SSE
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const eventStream = createEventStream(event)

    // Timestamp du début de la connexion
    let lastMessageTime = new Date()

    // Fonction pour vérifier les nouveaux messages
    const checkForNewMessages = async () => {
      try {
        const newMessages = await prisma.message.findMany({
          where: {
            conversationId,
            deletedAt: null,
            createdAt: {
              gt: lastMessageTime,
            },
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
            createdAt: 'asc',
          },
        })

        if (newMessages.length > 0) {
          // Envoyer les nouveaux messages
          for (const message of newMessages) {
            await eventStream.push(JSON.stringify({ type: 'message', data: message }))
          }

          // Mettre à jour le timestamp
          lastMessageTime = newMessages[newMessages.length - 1].createdAt
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des nouveaux messages:', error)
      }
    }

    // Envoyer un ping toutes les 30 secondes pour garder la connexion vivante
    const pingInterval = setInterval(async () => {
      try {
        await eventStream.push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        await checkForNewMessages()
      } catch (error) {
        console.error('Erreur lors du ping:', error)
        clearInterval(pingInterval)
      }
    }, 30000)

    // Vérifier les messages toutes les 2 secondes
    const messageCheckInterval = setInterval(async () => {
      await checkForNewMessages()
    }, 2000)

    // Nettoyer lors de la fermeture de la connexion
    event.node.req.on('close', () => {
      clearInterval(pingInterval)
      clearInterval(messageCheckInterval)
      eventStream.close()
    })

    return eventStream.send()
  },
  { operationName: 'StreamConversationMessages' }
)
