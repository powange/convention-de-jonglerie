import { canManageArtistsById } from './permissions/edition-permissions'

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
  /**
   * Le droit de gestion des artistes sur cette édition, tel que `canManageArtistsById` le
   * décide : créateur de l'édition, auteur de la convention, organisateur habilité au niveau
   * convention ou par édition, ou admin en mode admin. C'est un seul champ et non un couple
   * « organisateur / admin » : la distinction n'était lue par personne, et l'entretenir avait
   * fini par produire deux règles d'accès divergentes.
   */
  peutGererLesArtistes: boolean
  editionId: number
  conventionId: number
}

/**
 * Vérifie l'accès à une candidature de spectacle : son artiste, ou quelqu'un qui a le droit de
 * gérer les artistes de l'édition.
 *
 * Ce droit est celui de `canManageArtistsById`, et c'est volontairement le MÊME appel que celui
 * de la fiche de candidature et de son PATCH. Ces deux fonctions énuméraient auparavant leur
 * propre règle, et elles avaient divergé de celle-là sur deux points, en sens contraires :
 *
 * - l'auteur d'une convention et le créateur d'une édition n'y étaient pas. Or la ligne
 *   organisateur créée à la création d'une convention n'a pas `canManageArtists` (défaut `false`,
 *   `conventions/index.post.ts`). L'auteur ouvrait donc la fiche d'une candidature et recevait un
 *   403 sur sa conversation ;
 * - un simple `EditionOrganizer`, en repli, l'ouvrait à quelqu'un qui ne peut pas voir la
 *   candidature. Ce repli est supprimé : il donnait accès aux échanges d'un artiste à tout
 *   organisateur inscrit comme présent sur l'édition, sans aucun droit sur les artistes.
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

  const peutGererLesArtistes = isArtist
    ? false
    : await canManageArtistsById(editionId, userId, event)

  if (!isArtist && !peutGererLesArtistes) {
    throw createError({
      status: 403,
      message: 'Accès non autorisé',
    })
  }

  return {
    application,
    isArtist,
    peutGererLesArtistes,
    editionId,
    conventionId,
  }
}

/**
 * Vérifie l'accès à une conversation de type ARTIST_APPLICATION.
 * Utilisé par les endpoints messenger pour permettre l'accès aux non-participants.
 *
 * Même règle que `requireShowApplicationAccess` ci-dessus, et pour la même raison : lire les
 * échanges d'une candidature ne peut pas être plus ou moins ouvert que lire la candidature.
 *
 * @param conversationId - L'ID de la conversation
 * @param userId - L'ID de l'utilisateur
 * @param event - L'événement H3 (le mode admin s'y lit)
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

  if (!isArtist && !(await canManageArtistsById(editionId, userId, event))) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas accès à cette conversation",
    })
  }

  return true
}
