import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { masquerMessageSupprime } from '#server/utils/messenger-message-affiche'
import { messengerStreamService } from '#server/utils/messenger-unread-service'
import { messengerMessageInclude } from '#server/utils/prisma-select-helpers'
import {
  DELAI_MODIFICATION_MESSAGE_MINUTES,
  messageEncoreModifiable,
} from '~~/shared/utils/message-modifiable'

const bodySchema = z.object({
  // Rogné comme à l'envoi : un message modifié en « \n » seul serait un message vide.
  content: z.string().trim().min(1).max(10000).optional(),
  deleted: z.boolean().optional(),
})

/**
 * PATCH /api/messenger/conversations/[conversationId]/messages/[messageId]
 * Modifie ou supprime un message
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const messageId = getRouterParam(event, 'messageId')!
    const body = await readBody(event)
    const { content, deleted } = bodySchema.parse(body)

    // Récupérer le message avec vérification des permissions
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        participant: {
          userId: user.id, // Seulement l'auteur peut modifier/supprimer
        },
      },
    })

    if (!message) {
      throw createError({
        status: 404,
        message: "Message non trouvé ou vous n'êtes pas autorisé à le modifier",
      })
    }

    // Si le message est déjà supprimé, interdire la modification
    if (message.deletedAt) {
      throw createError({
        status: 400,
        message: 'Impossible de modifier un message supprimé',
      })
    }

    // Le délai ne vaut que pour la modification : on peut toujours retirer un message.
    if (deleted !== true && content !== undefined && !messageEncoreModifiable(message.createdAt)) {
      throw createError({
        status: 400,
        message: `Un message ne peut plus être modifié ${DELAI_MODIFICATION_MESSAGE_MINUTES} minutes après son envoi`,
      })
    }

    // Préparer les données de mise à jour
    const updateData: any = {}

    if (deleted === true) {
      updateData.deletedAt = new Date()
    } else if (content !== undefined) {
      updateData.content = content
      updateData.editedAt = new Date()
    }

    // Mettre à jour le message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: updateData,
      // La citation aussi : l'écran remplace le message par cette réponse, et sans elle la
      // citation d'une réponse disparaissait à la première modification.
      include: messengerMessageInclude,
    })

    const messageAffiche = masquerMessageSupprime(updatedMessage)

    /*
     * Diffuser la modification aux AUTRES participants actifs.
     *
     * C'est la seconde moitié de ce que le sondage faisait : il relisait toutes les cinq secondes
     * les messages dont `editedAt` ou `deletedAt` avait bougé. La modification est connue ici, il
     * n'y a rien à retrouver.
     *
     * `leftAt: null` : quelqu'un qui a quitté la conversation ne doit plus rien en recevoir — c'est
     * la même condition que les points d'API de lecture, et la faire diverger rouvrirait par le
     * flux un accès que la liste refuse.
     *
     * L'auteur est exclu : il vient de recevoir la réponse, qui porte la même forme.
     */
    const autresParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null, userId: { not: user.id } },
      select: { userId: true },
    })

    if (autresParticipants.length > 0) {
      messengerStreamService
        .sendMessageUpdatedToUsers(
          autresParticipants.map((p) => p.userId),
          messageAffiche
        )
        .catch((error) => {
          console.error('[Messenger] Diffusion de la modification échouée :', error)
        })
    }

    return createSuccessResponse(messageAffiche)
  },
  { operationName: 'UpdateMessage' }
)
