import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  messengerStreamService,
  messengerUnreadService,
} from '#server/utils/messenger-unread-service'

const bodySchema = z.object({
  messageId: z.string(),
})

/**
 * PATCH /api/messenger/conversations/[conversationId]/mark-read
 * Met à jour le lastReadMessageId d'une conversation pour l'utilisateur connecté
 * Utilisé pour marquer un message comme lu et détecter si l'utilisateur est actif sur la conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const body = await readBody(event)
    const { messageId } = bodySchema.parse(body)

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
        status: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Vérifier que le message appartient bien à cette conversation
    // Note: On autorise de marquer comme lu un message supprimé
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
    })

    if (!message) {
      throw createError({
        status: 404,
        message: 'Message introuvable dans cette conversation',
      })
    }

    // Mettre à jour le lastReadMessageId
    await prisma.conversationParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        lastReadMessageId: messageId,
        lastReadAt: new Date(), // On garde aussi lastReadAt pour compatibilité
      },
    })

    // Envoyer le compteur de messages non lus mis à jour via SSE
    messengerUnreadService.sendUnreadCountToUser(user.id).catch((error) => {
      console.error('[Messenger] Erreur lors de la mise à jour du compteur SSE:', error)
    })

    /*
     * Prévenir les AUTRES que cette personne a lu jusqu'ici — l'indicateur « lu par ».
     *
     * Le flux par conversation le déduisait en relisant toutes les cinq secondes le
     * `lastReadMessageId` de chaque autre participant, et en comparant à ce qu'il avait mémorisé.
     * Une requête de plus toutes les cinq secondes, par connexion, pour détecter un changement que
     * ce point d'API vient précisément d'écrire.
     *
     * `leftAt: null`, comme partout ailleurs : qui a quitté la conversation n'en reçoit plus rien.
     */
    const autresParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null, userId: { not: user.id } },
      select: { userId: true },
    })

    if (autresParticipants.length > 0) {
      messengerStreamService
        .sendReadToUsers(
          autresParticipants.map((p) => p.userId),
          { conversationId, readerId: user.id, lastReadMessageId: messageId }
        )
        .catch((error) => {
          console.error('[Messenger] Diffusion de la lecture échouée :', error)
        })
    }

    return createSuccessResponse(null)
  },
  { operationName: 'MarkConversationAsRead' }
)
