import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère les informations publiques d'un appel à spectacles
 * Accessible par tout le monde (pas besoin d'authentification)
 * Avec ?preview=true, les organisateurs peuvent voir les appels OFFLINE
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))
    const preview = getQuery(event).preview === 'true'

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Récupérer l'édition pour vérifier qu'elle est publiée
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Si l'édition n'est pas publiée, ne pas exposer l'appel à spectacles
    if (edition.status === 'OFFLINE') {
      throw createError({
        status: 404,
        message: 'Édition non disponible',
      })
    }

    // Récupérer l'appel à spectacles
    const showCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
    })

    if (!showCall) {
      throw createError({
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Les appels hors ligne ne sont pas accessibles publiquement
    // sauf en mode preview pour les organisateurs
    if (showCall.visibility === 'OFFLINE') {
      if (!preview) {
        throw createError({
          status: 403,
          message: 'Appel à spectacles hors ligne',
        })
      }

      // Vérifier que l'utilisateur est organisateur
      const user = optionalAuth(event)
      if (!user) {
        throw createError({
          status: 403,
          message: 'Appel à spectacles hors ligne',
        })
      }

      const editionWithPerms = await getEditionWithPermissions(editionId, {
        userId: user.id,
      })

      if (!editionWithPerms || !canManageArtists(editionWithPerms, user)) {
        throw createError({
          status: 403,
          message: 'Appel à spectacles hors ligne',
        })
      }
    }

    // Retourner les informations publiques
    return {
      id: showCall.id,
      name: showCall.name,
      visibility: showCall.visibility,
      mode: showCall.mode,
      externalUrl: showCall.externalUrl,
      description: showCall.description,
      deadline: showCall.deadline,
      askPortfolioUrl: showCall.askPortfolioUrl,
      askVideoUrl: showCall.askVideoUrl,
      askTechnicalNeeds: showCall.askTechnicalNeeds,
      askAccommodation: showCall.askAccommodation,
      askDepartureCity: showCall.askDepartureCity,
      askSocialLinks: showCall.askSocialLinks,
    }
  },
  { operationName: 'GetPublicShowCallInfo' }
)
