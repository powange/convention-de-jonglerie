import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
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

    const showCall = await prisma.editionShowCall.findFirst({
      where: { id: showCallId, editionId },
    })
    if (!showCall) throw createError({ status: 404, message: 'Appel à spectacles non trouvé' })
    if (!showCall.surveyToken) {
      throw createError({ status: 400, message: "Aucun sondage n'a été créé pour cet appel" })
    }

    const body = await readBody(event)
    const { open } = z.object({ open: z.boolean() }).parse(body)

    const updated = await prisma.editionShowCall.update({
      where: { id: showCallId },
      data: { surveyOpen: open },
    })

    return createSuccessResponse({ surveyOpen: updated.surveyOpen })
  },
  { operationName: 'UpdateSurveyStatus' }
)
