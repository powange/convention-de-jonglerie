import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère les informations publiques d'un appel à spectacles
 * Accessible par tout le monde (pas besoin d'authentification)
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

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
    if (showCall.visibility === 'OFFLINE') {
      throw createError({
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
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
