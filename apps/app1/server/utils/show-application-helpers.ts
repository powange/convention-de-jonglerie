import { checkAdminMode } from './organizer-management'

import type { H3Event, EventHandlerRequest } from 'h3'

/**
 * Résultat de la vérification d'accès à une candidature
 */
export interface ShowApplicationAccess {
  application: {
    id: number
    userId: number
    showCall: {
      edition: {
        id: number
        conventionId: number
      }
    }
  }
  isArtist: boolean
  isOrganizer: boolean
  isAdminMode: boolean
  editionId: number
  conventionId: number
}

/**
 * Vérifie l'accès à une candidature de spectacle
 *
 * @param event - L'événement H3
 * @param userId - L'ID de l'utilisateur authentifié
 * @returns Les informations d'accès ou lance une erreur HTTP
 *
 * @throws 400 si l'ID de candidature est invalide
 * @throws 404 si la candidature n'existe pas
 * @throws 403 si l'utilisateur n'a pas accès
 */
export async function requireShowApplicationAccess(
  event: H3Event<EventHandlerRequest>,
  userId: number
): Promise<ShowApplicationAccess> {
  const applicationId = parseInt(getRouterParam(event, 'applicationId')!)

  if (isNaN(applicationId)) {
    throw createError({
      status: 400,
      message: 'ID de candidature invalide',
    })
  }

  // Récupérer la candidature avec les relations nécessaires
  const application = await prisma.showApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      showCall: {
        select: {
          edition: {
            select: {
              id: true,
              conventionId: true,
            },
          },
        },
      },
    },
  })

  if (!application) {
    throw createError({
      status: 404,
      message: 'Candidature introuvable',
    })
  }

  const isArtist = application.userId === userId
  const editionId = application.showCall.edition.id
  const conventionId = application.showCall.edition.conventionId

  // Vérifier si l'utilisateur est organisateur avec droits canManageArtists
  let isOrganizer = false
  if (!isArtist) {
    const organizerWithRights = await prisma.conventionOrganizer.findFirst({
      where: {
        conventionId,
        userId,
        OR: [
          { canManageArtists: true },
          {
            perEditionPermissions: {
              some: {
                editionId,
                canManageArtists: true,
              },
            },
          },
        ],
      },
    })
    isOrganizer = !!organizerWithRights

    // Fallback : vérifier si c'est un organisateur de l'édition (sans droits spécifiques)
    if (!isOrganizer) {
      const editionOrganizer = await prisma.editionOrganizer.findFirst({
        where: {
          editionId,
          organizer: {
            userId,
          },
        },
      })
      isOrganizer = !!editionOrganizer
    }
  }

  // Les admins ont accès à toutes les candidatures
  const isAdminMode = await checkAdminMode(userId, event)

  if (!isArtist && !isOrganizer && !isAdminMode) {
    throw createError({
      status: 403,
      message: 'Accès non autorisé',
    })
  }

  return {
    application,
    isArtist,
    isOrganizer,
    isAdminMode,
    editionId,
    conventionId,
  }
}

/**
 * Vérifie l'accès à une conversation de type ARTIST_APPLICATION
 * Utilisé par les endpoints messenger pour permettre l'accès aux non-participants
 *
 * @param conversationId - L'ID de la conversation
 * @param userId - L'ID de l'utilisateur
 * @param event - L'événement H3 (pour checkAdminMode)
 * @returns true si l'accès est autorisé
 * @throws 403 si l'accès est refusé
 */
export async function checkArtistApplicationConversationAccess(
  conversationId: string,
  userId: number,
  event: H3Event<EventHandlerRequest>
): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      type: true,
      showApplication: {
        select: {
          userId: true,
          showCall: {
            select: {
              edition: {
                select: {
                  id: true,
                  conventionId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // Si ce n'est pas une conversation ARTIST_APPLICATION, refuser l'accès
  if (conversation?.type !== 'ARTIST_APPLICATION' || !conversation.showApplication) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas accès à cette conversation",
    })
  }

  const { showApplication } = conversation
  const isArtist = showApplication.userId === userId
  const editionId = showApplication.showCall.edition.id
  const conventionId = showApplication.showCall.edition.conventionId

  // Vérifier les droits organisateur
  let isOrganizer = false
  if (!isArtist) {
    const organizerWithRights = await prisma.conventionOrganizer.findFirst({
      where: {
        conventionId,
        userId,
        OR: [
          { canManageArtists: true },
          {
            perEditionPermissions: {
              some: {
                editionId,
                canManageArtists: true,
              },
            },
          },
        ],
      },
    })
    isOrganizer = !!organizerWithRights

    if (!isOrganizer) {
      const editionOrganizer = await prisma.editionOrganizer.findFirst({
        where: {
          editionId,
          organizer: { userId },
        },
      })
      isOrganizer = !!editionOrganizer
    }
  }

  const isAdminMode = await checkAdminMode(userId, event)

  if (!isArtist && !isOrganizer && !isAdminMode) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas accès à cette conversation",
    })
  }

  return true
}
