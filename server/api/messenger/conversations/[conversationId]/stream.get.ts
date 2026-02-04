import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { conversationPresenceService } from '#server/utils/conversation-presence-service'
import { checkArtistApplicationConversationAccess } from '#server/utils/show-application-helpers'

/**
 * GET /api/messenger/conversations/[conversationId]/stream
 * Stream SSE pour recevoir les nouveaux messages en temps réel
 * Permet également de tracker la présence des utilisateurs sur la conversation
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

    // Si pas participant, vérifier l'accès spécial pour les conversations ARTIST_APPLICATION
    if (!participant) {
      await checkArtistApplicationConversationAccess(conversationId, user.id, event)
    }

    // Marquer l'utilisateur comme présent sur cette conversation
    conversationPresenceService.markPresent(user.id, conversationId)

    // Configurer SSE
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const eventStream = createEventStream(event)

    // Timestamp du début de la connexion
    let lastMessageTime = new Date()
    let lastUpdateCheckTime = new Date()

    // Fonction pour vérifier les nouveaux messages
    const checkForNewMessages = async () => {
      try {
        // 1. Vérifier les nouveaux messages (createdAt récent)
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

        // 2. Vérifier les messages supprimés ou modifiés récemment
        const updatedMessages = await prisma.message.findMany({
          where: {
            conversationId,
            OR: [
              {
                deletedAt: {
                  gte: lastUpdateCheckTime,
                },
              },
              {
                editedAt: {
                  gte: lastUpdateCheckTime,
                },
              },
            ],
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

        if (updatedMessages.length > 0) {
          for (const message of updatedMessages) {
            // Envoyer un événement de type "message-updated" pour les suppressions/modifications
            await eventStream.push(
              JSON.stringify({
                type: 'message-updated',
                data: {
                  ...message,
                  // Masquer le contenu si le message est supprimé
                  content: message.deletedAt ? 'Message supprimé' : message.content,
                },
              })
            )
          }
        }

        // Mettre à jour le timestamp de vérification des updates
        lastUpdateCheckTime = new Date()
      } catch (error) {
        console.error('Erreur lors de la vérification des nouveaux messages:', error)
      }
    }

    // Nettoyer lors de la fermeture de la connexion
    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      clearInterval(pingInterval)
      clearInterval(messageCheckInterval)
      // Marquer l'utilisateur comme absent
      conversationPresenceService.markAbsent(user.id, conversationId)
      try {
        eventStream.close()
      } catch {
        // Ignorer les erreurs de fermeture
      }
    }

    // Envoyer un ping toutes les 30 secondes pour garder la connexion vivante
    const pingInterval = setInterval(async () => {
      try {
        await eventStream.push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        await checkForNewMessages()
      } catch (error) {
        console.error('Erreur lors du ping:', error)
        cleanup()
      }
    }, 30000)

    // Vérifier les messages toutes les 5 secondes et envoyer un heartbeat pour détecter les déconnexions
    const messageCheckInterval = setInterval(async () => {
      try {
        // Envoyer un heartbeat silencieux pour détecter si la connexion est fermée
        await eventStream.push(JSON.stringify({ type: 'heartbeat' }))
        await checkForNewMessages()
      } catch {
        cleanup()
      }
    }, 5000)

    event.node.req.on('close', cleanup)
    event.node.req.on('aborted', cleanup)
    event.node.req.on('error', cleanup)

    return eventStream.send()
  },
  { operationName: 'StreamConversationMessages' }
)
