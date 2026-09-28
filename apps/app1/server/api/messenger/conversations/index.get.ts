import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureOrganizersGroupConversation } from '#server/utils/messenger-helpers'
import { compterNonLusParConversation } from '#server/utils/messenger-unread-service'
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
          eventId: editionId,
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
        // Le titre du spectacle nomme le groupe SHOW_GROUP dans la liste
        show: {
          select: {
            id: true,
            title: true,
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
            lastReadMessageId: true,
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

    /*
     * Les non-lus de TOUTES les conversations en une requête, et les responsables une fois par
     * équipe.
     *
     * Cette boucle faisait auparavant deux appels par conversation : un `message.count`, et — pour
     * une conversation d'équipe — une recherche des responsables. Deux équipes n'ayant jamais qu'un
     * seul jeu de responsables, la seconde était répétée autant de fois qu'il y a de conversations
     * sur la même équipe.
     */
    const nonLusParConversation = await compterNonLusParConversation(user.id)

    const responsablesParEquipe = new Map<number, Set<number>>()
    for (const teamId of new Set(
      conversations.map((c) => c.teamId).filter((id): id is number => id !== null)
    )) {
      responsablesParEquipe.set(
        teamId,
        // Responsables de l'équipe, bénévoles comme organisateurs : le badge doit paraître
        // sur l'un comme sur l'autre.
        new Set(await utilisateursResponsablesDeLEquipe(editionId, teamId))
      )
    }

    const conversationsWithUnreadCount = conversations.map((conversation) => {
      const estParticipant = conversation.participants.some((p) => p.userId === user.id)

      /*
       * Sortie anticipée pour qui n'est pas participant : zéro non-lu, et AUCUN `isLeader` sur les
       * participants. C'est exactement ce que faisait le code précédent, et c'est conservé tel quel
       * — un organisateur qui lit une conversation d'équipe sans y être inscrit ne voit donc pas les
       * badges de responsable. L'asymétrie est douteuse, mais la corriger n'est pas l'objet de ce
       * lot, qui ne touche qu'au nombre de requêtes.
       */
      if (!estParticipant) {
        return { ...conversation, unreadCount: 0 }
      }

      const responsables = conversation.teamId
        ? responsablesParEquipe.get(conversation.teamId)
        : undefined

      return {
        ...conversation,
        participants: responsables
          ? conversation.participants.map((participant) => ({
              ...participant,
              isLeader: responsables.has(participant.userId),
            }))
          : conversation.participants,
        unreadCount: nonLusParConversation.get(conversation.id) ?? 0,
      }
    })

    return createSuccessResponse(conversationsWithUnreadCount)
  },
  { operationName: 'GetUserConversations' }
)
