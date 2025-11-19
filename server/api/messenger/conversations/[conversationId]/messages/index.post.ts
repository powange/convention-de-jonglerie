import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { pushNotificationService } from '@@/server/utils/push-notification-service'
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
                emailHash: true,
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

    // Envoyer des notifications push aux autres participants (uniquement s'ils ne sont pas sur la page)
    const teamName = participant.conversation.team?.name
    const conversationType = participant.conversation.type

    const notificationTitle =
      conversationType === 'TEAM_GROUP'
        ? `Nouveau message dans ${teamName}`
        : conversationType === 'VOLUNTEER_TO_ORGANIZERS'
          ? 'Nouveau message des responsables bénévoles'
          : `Nouveau message du responsable de ${teamName}`

    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content

    // Récupérer tous les participants avec leur lastReadMessageId pour déterminer s'ils ont déjà lu ce message
    const participantsWithReadStatus = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        leftAt: null,
        userId: {
          not: user.id, // Tous les participants sauf l'envoyeur
        },
      },
      select: {
        userId: true,
        lastReadMessageId: true,
      },
    })

    // Récupérer tous les messages de la conversation pour déterminer si le participant est à jour
    const allMessagesIds = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2, // On ne prend que les 2 derniers messages (le nouveau + le précédent)
    })

    // Le message précédent (celui juste avant le nouveau qu'on vient de créer)
    const previousMessageId = allMessagesIds.length > 1 ? allMessagesIds[1].id : null

    await Promise.all(
      participantsWithReadStatus.map(async (p) => {
        try {
          // Vérifier si l'utilisateur a lu le message précédent
          // Si lastReadMessageId === previousMessageId, alors il est à jour et sur la conversation
          const isUpToDate = previousMessageId && p.lastReadMessageId === previousMessageId

          // Ne pas envoyer de push si l'utilisateur est à jour (il est sur la conversation)
          if (isUpToDate) {
            console.log(
              `[Messenger] Utilisateur ${p.userId} est à jour sur la conversation, pas de push envoyée`
            )
            return
          }

          // Envoyer la notification push
          await pushNotificationService.sendToUser(p.userId, {
            title: notificationTitle,
            message: `${user.pseudo}: ${truncatedContent}`,
            url: `/messenger?editionId=${participant.conversation.edition.id}&conversationId=${conversationId}`,
            actionText: 'Voir le message',
            icon: '/favicons/android-chrome-192x192.png',
            badge: '/favicons/favicon-32x32.png',
          })

          console.log(
            `[Messenger] Notification push envoyée à l'utilisateur ${p.userId} pour le message dans la conversation ${conversationId}`
          )
        } catch (error) {
          console.error(
            `Erreur lors de l'envoi de la notification push à l'utilisateur ${p.userId}:`,
            error
          )
        }
      })
    )

    // Transformer le message pour supprimer participantId
    const { participantId: _participantId, ...messageWithoutParticipantId } = message

    return {
      success: true,
      data: messageWithoutParticipantId,
    }
  },
  { operationName: 'SendMessage' }
)
