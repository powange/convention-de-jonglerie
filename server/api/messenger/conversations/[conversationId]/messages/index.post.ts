import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { NotificationService } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
})

/**
 * POST /api/messenger/conversations/[conversationId]/messages
 * Envoie un nouveau message dans une conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const body = await readBody(event)
    const { content } = bodySchema.parse(body)

    // Vérifier que l'utilisateur est participant de cette conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
        leftAt: null,
      },
      include: {
        conversation: {
          include: {
            team: {
              select: {
                name: true,
              },
            },
            edition: {
              select: {
                id: true,
                name: true,
                convention: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            participants: {
              where: {
                leftAt: null,
                userId: {
                  not: user.id, // Tous les participants sauf l'envoyeur
                },
              },
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!participant) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        conversationId,
        participantId: participant.id,
        content,
      },
      include: {
        participant: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true,
              },
            },
          },
        },
      },
    })

    // Mettre à jour la conversation (updatedAt)
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Envoyer des notifications aux autres participants
    const _editionName =
      participant.conversation.edition.name || participant.conversation.edition.convention.name
    const teamName = participant.conversation.team?.name
    const conversationType = participant.conversation.type

    const notificationTitle =
      conversationType === 'TEAM_GROUP'
        ? `Nouveau message dans ${teamName}`
        : conversationType === 'VOLUNTEER_TO_ORGANIZERS'
          ? 'Nouveau message des responsables bénévoles'
          : `Nouveau message du responsable de ${teamName}`

    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content

    await Promise.all(
      participant.conversation.participants.map(async (p) => {
        try {
          await NotificationService.create({
            userId: p.userId,
            type: 'INFO',
            title: notificationTitle,
            message: `${user.pseudo}: ${truncatedContent}`,
            category: 'messenger',
            entityType: 'Conversation',
            entityId: conversationId,
            actionUrl: `/messenger?editionId=${participant.conversation.edition.id}&conversationId=${conversationId}`,
            actionText: 'Voir le message',
            notificationType: 'new_message',
          })
        } catch (error) {
          console.error(
            `Erreur lors de l'envoi de la notification à l'utilisateur ${p.userId}:`,
            error
          )
        }
      })
    )

    // Transformer le message pour ajouter emailHash et supprimer email
    const { email, ...userWithoutEmail } = message.participant.user
    const transformedMessage = {
      ...message,
      participant: {
        ...message.participant,
        user: {
          ...userWithoutEmail,
          emailHash: getEmailHash(email),
        },
      },
    }

    return {
      success: true,
      data: transformedMessage,
    }
  },
  { operationName: 'SendMessage' }
)
