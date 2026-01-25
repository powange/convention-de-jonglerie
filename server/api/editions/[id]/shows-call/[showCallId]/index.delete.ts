import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'

/**
 * Supprime un appel à spectacles
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 * Supprime également toutes les candidatures associées
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        statusCode: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour supprimer cet appel à spectacles",
      })
    }

    // Vérifier que l'appel existe
    const showCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
    })

    if (!showCall) {
      throw createError({
        statusCode: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Supprimer l'appel (les candidatures seront supprimées en cascade)
    await prisma.editionShowCall.delete({
      where: { id: showCallId },
    })

    return {
      success: true,
      deletedApplicationsCount: showCall._count.applications,
    }
  },
  { operationName: 'DeleteShowCall' }
)
