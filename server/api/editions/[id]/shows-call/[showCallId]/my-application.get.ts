import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère la candidature de l'utilisateur connecté pour un appel à spectacles
 * Accessible par tout utilisateur authentifié
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
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
      return {
        application: null,
        showCall: null,
      }
    }

    // Récupérer la candidature de l'utilisateur
    const application = await prisma.showApplication.findUnique({
      where: {
        showCallId_userId: {
          showCallId: showCall.id,
          userId: user.id,
        },
      },
    })

    // Retourner aussi les infos de l'appel (public)
    return {
      application,
      showCall: {
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
      },
    }
  },
  { operationName: 'GetMyShowCallApplication' }
)
