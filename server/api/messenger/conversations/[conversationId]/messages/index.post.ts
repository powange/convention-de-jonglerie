import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getUserAvatarUrl } from '#server/utils/avatar-url'
import { conversationPresenceService } from '#server/utils/conversation-presence-service'
import {
  messengerStreamService,
  messengerUnreadService,
} from '#server/utils/messenger-unread-service'
import { unifiedPushService } from '#server/utils/unified-push-service'

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
  replyToId: z.string().optional(), // ID du message auquel on répond
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
    const { content, replyToId } = bodySchema.parse(body)

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
            showApplication: {
              select: {
                id: true,
                showCall: {
                  select: {
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
        status: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Si replyToId est fourni, vérifier que le message existe et appartient à la même conversation
    if (replyToId) {
      const replyToMessage = await prisma.message.findFirst({
        where: {
          id: replyToId,
          conversationId,
        },
      })

      if (!replyToMessage) {
        throw createError({
          status: 400,
          message: "Le message auquel vous tentez de répondre n'existe pas dans cette conversation",
        })
      }
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        conversationId,
        participantId: participant.id,
        content,
        replyToId,
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
        replyTo: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            deletedAt: true,
            participant: {
              select: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                  },
                },
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
    // Pour ARTIST_APPLICATION, l'édition est via showApplication.showCall.edition
    const showApplication = participant.conversation.showApplication
    const editionFromShowApplication = showApplication?.showCall.edition
    const editionName = participant.conversation.edition?.name ?? editionFromShowApplication?.name
    const editionId = participant.conversation.edition?.id ?? editionFromShowApplication?.id
    const conventionName =
      participant.conversation.edition?.convention?.name ??
      editionFromShowApplication?.convention?.name

    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content

    // Récupérer tous les participants avec leur lastReadMessageId et leurs rôles pour déterminer le titre de notification
    // Pour les conversations privées, on n'a pas besoin des infos d'organisation/bénévolat
    const teamId = participant.conversation.teamId
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
            pseudo: true,
            // Uniquement pour les conversations liées à une édition
            ...(editionId
              ? {
                  organizations: {
                    where: {
                      convention: {
                        editions: {
                          some: {
                            id: editionId,
                          },
                        },
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  // Uniquement si la conversation a une équipe associée
                  ...(teamId
                    ? {
                        volunteerApplications: {
                          where: {
                            editionId: editionId,
                            status: 'ACCEPTED',
                          },
                          select: {
                            teamAssignments: {
                              where: {
                                teamId: teamId,
                                isLeader: true,
                              },
                              select: {
                                isLeader: true,
                              },
                            },
                          },
                        },
                      }
                    : {}),
                }
              : {}),
          },
        },
      },
    })

    await Promise.all(
      participantsWithReadStatus.map(async (p) => {
        try {
          // Vérifier si l'utilisateur est présent sur la conversation (via connexion SSE active)
          const isPresent = conversationPresenceService.isPresent(p.userId, conversationId)

          // Ne pas envoyer de push si l'utilisateur est présent sur la conversation
          if (isPresent) {
            console.log(
              `[Messenger] Utilisateur ${p.userId} est présent sur la conversation (SSE actif), pas de push envoyée`
            )
            return
          }

          // Déterminer le titre de la notification en fonction du type de conversation et du rôle du destinataire
          let notificationTitle: string

          // Pour les conversations privées 1-à-1 (sans édition)
          if (conversationType === 'PRIVATE') {
            notificationTitle = `Message de ${user.pseudo}`
          } else {
            // Pour les conversations liées à une édition
            const userWithOrgs = p.user as {
              pseudo: string
              organizations?: { id: number }[]
              volunteerApplications?: { teamAssignments: { isLeader: boolean }[] }[]
            }
            const isOrganizer = userWithOrgs.organizations?.length ?? 0 > 0

            // Vérifier si l'utilisateur est responsable d'équipe pour cette conversation
            const isTeamLeader =
              userWithOrgs.volunteerApplications?.some((app) =>
                app.teamAssignments.some((assignment) => assignment.isLeader)
              ) ?? false

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
            } else if (conversationType === 'ORGANIZERS_GROUP') {
              // Pour un groupe d'organisateurs
              notificationTitle = `Nouveau message des organisateurs - ${editionName}`
            } else if (conversationType === 'ARTIST_APPLICATION') {
              // Pour une conversation liée à une candidature artiste
              notificationTitle = `Nouveau message - Candidature spectacle ${conventionName ?? ''}`
            } else {
              // Fallback
              notificationTitle = `Nouveau message - ${editionName}`
            }
          }

          // Générer l'URL de l'avatar de l'expéditeur
          const config = useRuntimeConfig()
          const baseUrl = config.public.siteUrl || 'https://juggling-convention.com'
          const senderUser = message.participant.user
          const senderAvatarUrl = getUserAvatarUrl(
            {
              id: senderUser.id,
              emailHash: senderUser.emailHash,
              profilePicture: senderUser.profilePicture,
            },
            baseUrl,
            96
          )

          // Envoyer la notification push (le service unifié gère les logs)
          // Pour les messages, l'icon est l'avatar de l'expéditeur
          // L'URL de la notification dépend du type de conversation
          let notificationUrl: string
          if (conversationType === 'ARTIST_APPLICATION' && showApplication?.id) {
            // Pour les candidatures artistes, pointer vers la page "Mes candidatures"
            notificationUrl = `/my-artist-applications?applicationId=${showApplication.id}`
          } else if (editionId) {
            notificationUrl = `/messenger?editionId=${editionId}&conversationId=${conversationId}`
          } else {
            notificationUrl = `/messenger?conversationId=${conversationId}`
          }

          await unifiedPushService.sendToUser(p.userId, {
            title: notificationTitle,
            message: `${user.pseudo}: ${truncatedContent}`,
            url: notificationUrl,
            actionText: 'Voir le message',
            icon: senderAvatarUrl, // Avatar de l'expéditeur comme icon principal
            badge: '/favicons/notification-badge.png',
          })
        } catch (error) {
          console.error(
            `Erreur lors de l'envoi de la notification push à l'utilisateur ${p.userId}:`,
            error
          )
        }
      })
    )

    // Envoyer les événements SSE aux autres participants
    const otherParticipantIds = participantsWithReadStatus.map((p) => p.userId)
    if (otherParticipantIds.length > 0) {
      // Données du nouveau message pour le stream SSE
      const newMessageData = {
        conversationId,
        messageId: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderId: user.id,
        senderPseudo: user.pseudo,
      }

      // Exécuter en arrière-plan sans bloquer la réponse
      Promise.all([
        // Envoyer la notification de nouveau message
        messengerStreamService.sendNewMessageToUsers(otherParticipantIds, newMessageData),
        // Envoyer le compteur de messages non lus mis à jour
        messengerUnreadService.sendUnreadCountToUsers(otherParticipantIds),
      ]).catch((error) => {
        console.error('[Messenger] Erreur lors de la mise à jour SSE:', error)
      })
    }

    // Transformer le message pour supprimer participantId
    const { participantId: _participantId, ...messageWithoutParticipantId } = message

    return {
      success: true,
      data: messageWithoutParticipantId,
    }
  },
  { operationName: 'SendMessage' }
)
