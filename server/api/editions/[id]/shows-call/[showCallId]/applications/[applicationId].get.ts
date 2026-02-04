import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'

/**
 * Récupère les détails d'une candidature de spectacle
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))
    const applicationId = Number(getRouterParam(event, 'applicationId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    if (isNaN(applicationId)) {
      throw createError({
        status: 400,
        message: 'ID de candidature invalide',
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour voir cette candidature",
      })
    }

    // Récupérer la candidature
    const application = await prisma.showApplication.findFirst({
      where: {
        id: applicationId,
        showCallId,
        showCall: {
          editionId,
        },
      },
      include: {
        showCall: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            emailHash: true,
            profilePicture: true,
          },
        },
        decidedBy: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
          },
        },
      },
    })

    if (!application) {
      throw createError({
        status: 404,
        message: 'Candidature non trouvée',
      })
    }

    return application
  },
  { operationName: 'GetShowCallApplicationDetails' }
)
