import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { z } from 'zod'

const bodySchema = z.object({
  content: z.string().min(1).max(10000).optional(),
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
      include: {
        participant: {
          select: {
            id: true,
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
      },
    })

    // Transformer le message pour supprimer participantId
    const { participantId: _participantId, ...messageWithoutParticipantId } = updatedMessage

    return {
      success: true,
      data: messageWithoutParticipantId,
    }
  },
  { operationName: 'UpdateMessage' }
)
