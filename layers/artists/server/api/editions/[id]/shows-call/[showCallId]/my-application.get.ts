import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
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

    /*
     * ⚠️ LES DÉTAILS D'UN APPEL HORS LIGNE NE SORTENT PAS D'ICI.
     *
     * Ce point d'API rendait SANS CONDITION le nom, la description, la date limite et les réglages
     * de n'importe quel appel de l'édition, OFFLINE compris : un identifiant deviné suffisait à
     * lire un appel en préparation. `public.get.ts` le refuse pourtant depuis toujours — deux
     * réponses différentes à la même question, et c'est la plus permissive qui servait de porte.
     *
     * ⚠️ LA CANDIDATURE, ELLE, EST CONSERVÉE. Elle appartient à qui la demande : la lui cacher
     * parce que l'organisateur a remis l'appel hors ligne lui retirerait la trace de sa propre
     * démarche. Seuls les DÉTAILS DE L'APPEL passent à `null`.
     */
    if (showCall.visibility === 'OFFLINE') {
      const editionAvecDroits = await getEditionWithPermissions(editionId, { userId: user.id })
      const peutGerer = editionAvecDroits ? canManageArtists(editionAvecDroits, user) : false
      if (!peutGerer) {
        return { application, showCall: null }
      }
    }

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
        askStageSetup: showCall.askStageSetup,
        askAccommodation: showCall.askAccommodation,
        askDepartureCity: showCall.askDepartureCity,
        requirePhone: showCall.requirePhone,
      },
    }
  },
  { operationName: 'GetMyShowCallApplication' }
)
