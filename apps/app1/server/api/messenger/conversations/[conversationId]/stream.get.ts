import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { conversationPresenceService } from '#server/utils/conversation-presence-service'
import { checkArtistApplicationConversationAccess } from '#server/utils/show-application-helpers'

/**
 * GET /api/messenger/conversations/[conversationId]/stream — la PRÉSENCE sur une conversation.
 *
 * ⚠️ CE FLUX NE TRANSPORTE PLUS LES MESSAGES. Il sondait la base toutes les cinq secondes, par
 * connexion ouverte : les nouveaux messages, les messages modifiés ou supprimés, puis le
 * `lastReadMessageId` de chaque autre participant — trois requêtes, pour trouver le plus souvent
 * rien. Dix personnes sur une conversation, c'était trente requêtes toutes les cinq secondes.
 *
 * Or tout cela est connu de celui qui l'écrit. L'envoi d'un message, sa modification et le
 * marquage comme lu diffusent désormais l'information par le flux global (`notificationStreamManager`,
 * événements `messenger_message`, `messenger_message_updated`, `messenger_read`), que le client
 * écoute déjà pour ses pastilles.
 *
 * Ce qui reste ici ne se déduit d'aucune écriture : être CONNECTÉ à cette conversation. Ouvrir ce
 * flux marque la personne présente, le fermer la marque absente, et le ping détecte la fermeture.
 * C'est la seule raison pour laquelle il subsiste.
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

    // Nettoyer lors de la fermeture de la connexion
    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      clearInterval(pingInterval)
      // Marquer l'utilisateur comme absent
      conversationPresenceService.markAbsent(user.id, conversationId)
      try {
        eventStream.close()
      } catch {
        // Ignorer les erreurs de fermeture
      }
    }

    /*
     * Un ping toutes les 30 secondes, et c'est tout ce que ce flux fait encore.
     *
     * Il sert à DEUX choses, et aucune n'est la lecture des messages : garder la connexion vivante
     * à travers les intermédiaires qui coupent les connexions inactives, et détecter sa fermeture
     * — c'est l'échec du `push` qui déclenche le `cleanup`, donc le `markAbsent` qui retire la
     * personne de la liste des présents.
     *
     * Le heartbeat de 5 secondes a disparu avec le sondage : le ping suffit à détecter une
     * fermeture, et rien d'autre ne dépendait de sa cadence.
     */
    const pingInterval = setInterval(async () => {
      try {
        await eventStream.push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      } catch (error) {
        console.error('Erreur lors du ping:', error)
        cleanup()
      }
    }, 30000)

    event.node.req.on('close', cleanup)
    event.node.req.on('aborted', cleanup)
    event.node.req.on('error', cleanup)

    return eventStream.send()
  },
  { operationName: 'StreamConversationMessages' }
)
