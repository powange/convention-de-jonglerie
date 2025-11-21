import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

/**
 * GET /api/messenger/stream
 * Stream SSE global pour tous les nouveaux messages de l'utilisateur
 * Permet de mettre à jour les compteurs de messages non lus en temps réel
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Configurer SSE
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Récupérer toutes les conversations de l'utilisateur
    const userConversations = await prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      select: {
        conversationId: true,
      },
    })

    const conversationIds = userConversations.map((p) => p.conversationId)

    const eventStream = createEventStream(event)

    // Envoyer un événement de connexion
    eventStream.push(
      JSON.stringify({ type: 'connected', conversationsCount: conversationIds.length })
    )

    if (conversationIds.length === 0) {
      return eventStream.send()
    }

    console.log('[Global Stream] Connexion établie pour user', user.id)

    // Timestamp du début de la connexion
    let lastMessageTime = new Date()

    // Fonction pour vérifier les événements de typing dans toutes les conversations
    const checkForTypingEvents = () => {
      try {
        const typingEvents = getTypingStatesForConversations(conversationIds)

        for (const event of typingEvents) {
          // Ne broadcaster que les événements de typing des autres utilisateurs
          const typingUserIds = event.userIds.filter((id) => id !== user.id)

          if (typingUserIds.length > 0) {
            eventStream.push(
              JSON.stringify({
                type: 'typing',
                data: {
                  conversationId: event.conversationId,
                  userIds: typingUserIds,
                },
              })
            )
          }
        }
      } catch (error) {
        console.error(
          '[Global Stream] Erreur lors de la vérification des événements typing:',
          error
        )
      }
    }

    // Fonction pour vérifier les nouveaux messages dans toutes les conversations
    const checkForNewMessages = async () => {
      try {
        const newMessages = await prisma.message.findMany({
          where: {
            conversationId: {
              in: conversationIds,
            },
            deletedAt: null,
            createdAt: {
              gt: lastMessageTime,
            },
          },
          include: {
            participant: {
              select: {
                userId: true,
                conversationId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        })

        if (newMessages.length > 0) {
          // Récupérer les détails complets des messages pour l'affichage dans la liste
          const messagesWithDetails = await prisma.message.findMany({
            where: {
              id: {
                in: newMessages.map((m) => m.id),
              },
            },
            select: {
              id: true,
              content: true,
              createdAt: true,
              conversationId: true,
              participant: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      pseudo: true,
                    },
                  },
                },
              },
            },
          })

          // Envoyer les notifications pour les messages des autres utilisateurs uniquement
          for (const message of messagesWithDetails) {
            // Ne pas envoyer les messages de l'utilisateur lui-même
            if (message.participant.userId === user.id) continue

            eventStream.push(
              JSON.stringify({
                type: 'new-message',
                data: {
                  conversationId: message.conversationId,
                  messageId: message.id,
                  content: message.content,
                  createdAt: message.createdAt,
                  participant: {
                    user: {
                      id: message.participant.user.id,
                    },
                  },
                },
              })
            )
          }

          // Mettre à jour le timestamp
          lastMessageTime = newMessages[newMessages.length - 1].createdAt
        }
      } catch (error) {
        console.error(
          '[Global Stream] Erreur lors de la vérification des nouveaux messages:',
          error
        )
      }
    }

    // Envoyer un ping toutes les 30 secondes pour garder la connexion vivante
    const pingInterval = setInterval(() => {
      try {
        eventStream.push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        checkForNewMessages()
        checkForTypingEvents()
      } catch (error) {
        console.error('[Global Stream] Erreur lors du ping:', error)
        clearInterval(pingInterval)
      }
    }, 30000)

    // Vérifier les messages et typing toutes les 2 secondes
    const messageCheckInterval = setInterval(() => {
      checkForNewMessages()
      checkForTypingEvents()
    }, 2000)

    // Nettoyer lors de la fermeture de la connexion
    event.node.req.on('close', () => {
      console.log('[Global Stream] Nettoyage connexion pour user', user.id)
      clearInterval(pingInterval)
      clearInterval(messageCheckInterval)
      eventStream.close()
    })

    return eventStream.send()
  },
  { operationName: 'StreamGlobalMessages' }
)
