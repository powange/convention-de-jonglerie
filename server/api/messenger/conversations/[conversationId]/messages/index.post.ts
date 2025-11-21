import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
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
    const editionName = participant.conversation.edition.name
    const conversationType = participant.conversation.type

    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content

    // Récupérer tous les participants avec leur lastReadMessageId et leurs rôles pour déterminer le titre de notification
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
        user: {
          select: {
            organizations: {
              where: {
                convention: {
                  editions: {
                    some: {
                      id: participant.conversation.edition.id,
                    },
                  },
                },
              },
              select: {
                id: true,
              },
            },
            volunteerApplications: {
              where: {
                editionId: participant.conversation.edition.id,
                status: 'ACCEPTED',
              },
              select: {
                teamAssignments: {
                  where: {
                    teamId: participant.conversation.teamId,
                    isLeader: true,
                  },
                  select: {
                    isLeader: true,
                  },
                },
              },
            },
          },
        },
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

          // Déterminer le titre de la notification en fonction du type de conversation et du rôle du destinataire
          let notificationTitle: string
          const isOrganizer = p.user.organizations.length > 0

          // Vérifier si l'utilisateur est responsable d'équipe pour cette conversation
          const isTeamLeader = p.user.volunteerApplications.some((app) =>
            app.teamAssignments.some((assignment) => assignment.isLeader)
          )

          if (conversationType === 'TEAM_GROUP') {
            // Pour un groupe d'équipe, même titre pour tout le monde
            notificationTitle = `Nouveau message dans ${teamName} - ${editionName}`
          } else if (conversationType === 'TEAM_LEADER_PRIVATE') {
            // Pour une conversation privée avec un responsable d'équipe
            if (isTeamLeader) {
              // Le destinataire est un responsable
              notificationTitle = `Nouveau message d'un bénévole ${teamName} - ${editionName}`
            } else {
              // Le destinataire est un bénévole
              notificationTitle = `Nouveau message d'un responsable ${teamName} - ${editionName}`
            }
          } else if (conversationType === 'VOLUNTEER_TO_ORGANIZERS') {
            // Pour une conversation bénévole <-> organisateurs
            if (isOrganizer) {
              // Le destinataire est un organisateur
              notificationTitle = `Nouveau message d'un bénévole ${editionName}`
            } else {
              // Le destinataire est un bénévole
              notificationTitle = `Nouveau message d'un organisateur ${editionName}`
            }
          } else {
            // Fallback
            notificationTitle = `Nouveau message - ${editionName}`
          }

          // Envoyer la notification push
          await pushNotificationService.sendToUser(p.userId, {
            title: notificationTitle,
            message: `${user.pseudo}: ${truncatedContent}`,
            url: `/messenger?editionId=${participant.conversation.edition.id}&conversationId=${conversationId}`,
            actionText: 'Voir le message',
            icon: '/favicons/android-chrome-192x192.png',
            badge: '/favicons/notification-badge.png',
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
