import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { generateSecureToken } from '#server/utils/token-generator'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({ status: 400, message: "ID de l'appel à spectacles invalide" })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) throw createError({ status: 404, message: 'Édition non trouvée' })
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour gérer ce sondage",
      })
    }

    // Verify show call exists
    const showCall = await prisma.editionShowCall.findFirst({
      where: { id: showCallId, editionId },
    })
    if (!showCall) throw createError({ status: 404, message: 'Appel à spectacles non trouvé' })

    // Generate new token (regeneration invalidates the old one)
    const surveyToken = generateSecureToken(16)
    await prisma.editionShowCall.update({
      where: { id: showCallId },
      data: { surveyToken, surveyOpen: true },
    })

    const config = useRuntimeConfig()
    const baseUrl = config.public?.siteUrl || `http://localhost:3000`
    const surveyUrl = `${baseUrl}/survey/${surveyToken}`

    return createSuccessResponse({ surveyToken, surveyUrl })
  },
  { operationName: 'GenerateSurveyToken' }
)
