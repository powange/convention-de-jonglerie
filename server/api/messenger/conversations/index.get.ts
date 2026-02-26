import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureOrganizersGroupConversation } from '#server/utils/messenger-helpers'
import { checkAdminMode } from '#server/utils/organizer-management'

const querySchema = z.object({
  editionId: z.string().transform((val) => parseInt(val, 10)),
})

/**
 * GET /api/messenger/conversations?editionId=123
 * Récupère les conversations d'un utilisateur pour une édition donnée
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const query = getQuery(event)
    const { editionId } = querySchema.parse(query)

    // Vérifier que l'utilisateur a accès à cette édition
    // Soit via une candidature de bénévole, soit en tant qu'organisateur
    const [volunteerApplication, edition, artistApplication] = await Promise.all([
      prisma.editionVolunteerApplication.findFirst({
        where: {
          editionId,
          userId: user.id,
        },
      }),
      prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          conventionId: true,
          convention: {
            select: {
              organizers: {
                where: {
                  userId: user.id,
                },
                select: {
                  id: true,
                },
              },
            },
          },
        },
      }),
      // Vérifier si l'utilisateur a une candidature artiste pour cette édition
      prisma.showApplication.findFirst({
        where: {
          userId: user.id,
          showCall: {
            edition: {
              id: editionId,
            },
          },
        },
      }),
    ])

    // Vérifier si l'utilisateur est un organisateur de l'édition (EditionOrganizer)
    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: {
        editionId,
        organizer: {
          userId: user.id,
        },
      },
    })

    const isConventionOrganizer = edition?.convention?.organizers?.length > 0
    const isEditionOrganizer = !!editionOrganizer
    const isArtist = !!artistApplication
    const isAdminMode = await checkAdminMode(user.id, event)
    const hasAccess =
      volunteerApplication || isConventionOrganizer || isEditionOrganizer || isArtist || isAdminMode

    if (!hasAccess) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas accès aux conversations de cette édition",
      })
    }

    // Si l'utilisateur est un organisateur de l'édition, s'assurer qu'il est dans la conversation groupe organisateurs
    if (isEditionOrganizer) {
      await ensureOrganizersGroupConversation(editionId)
    }

    // Récupérer les conversations de l'utilisateur pour cette édition
    // Inclut les conversations directement liées à l'édition ET les conversations ARTIST_APPLICATION
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          // Conversations directement liées à l'édition
          { editionId },
          // Conversations ARTIST_APPLICATION liées à cette édition via showApplication
          {
            type: 'ARTIST_APPLICATION',
            showApplication: {
              showCall: {
                edition: {
                  id: editionId,
                },
              },
            },
          },
        ],
        participants: {
          some: {
            userId: user.id,
            leftAt: null, // Seulement les conversations actives
          },
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        // Inclure les infos de la candidature pour les conversations ARTIST_APPLICATION
        showApplication: {
          select: {
            id: true,
            showTitle: true,
            artistName: true,
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
        participants: {
          where: {
            leftAt: null, // Seulement les participants actifs
          },
          select: {
            id: true,
            userId: true,
            lastReadAt: true,
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
        messages: {
          where: {
            deletedAt: null, // Ne récupérer que les messages non supprimés
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            participant: {
              select: {
                userId: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Calculer le nombre de messages non lus et enrichir avec isLeader pour chaque conversation
    const conversationsWithUnreadCount = await Promise.all(
      conversations.map(async (conversation) => {
        const currentUserParticipant = conversation.participants.find((p) => p.userId === user.id)

        if (!currentUserParticipant) {
          return { ...conversation, unreadCount: 0 }
        }

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            deletedAt: null,
            createdAt: {
              gt: currentUserParticipant.lastReadAt || new Date(0),
            },
            participant: {
              userId: {
                not: user.id, // Ne pas compter ses propres messages
              },
            },
          },
        })

        // Pour les conversations d'équipe, récupérer l'information isLeader pour chaque participant
        let participantsWithLeaderInfo = conversation.participants

        if (conversation.teamId) {
          // Récupérer les informations isLeader pour tous les participants de cette équipe
          const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
            where: {
              teamId: conversation.teamId,
              application: {
                userId: {
                  in: conversation.participants.map((p) => p.userId),
                },
                editionId,
              },
            },
            select: {
              isLeader: true,
              application: {
                select: {
                  userId: true,
                },
              },
            },
          })

          // Mapper les participants avec leur statut isLeader
          participantsWithLeaderInfo = conversation.participants.map((participant) => {
            const assignment = leaderAssignments.find(
              (a) => a.application.userId === participant.userId
            )
            return {
              ...participant,
              isLeader: assignment?.isLeader || false,
            }
          })
        }

        return {
          ...conversation,
          participants: participantsWithLeaderInfo,
          unreadCount,
        }
      })
    )

    return createSuccessResponse(conversationsWithUnreadCount)
  },
  { operationName: 'GetUserConversations' }
)
