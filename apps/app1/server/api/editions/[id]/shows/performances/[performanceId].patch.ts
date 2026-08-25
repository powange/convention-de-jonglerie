import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * Retouches ponctuelles d'une représentation depuis la frise du programme : son lieu, sa
 * publication. Le formulaire du spectacle, lui, réécrit l'ensemble des représentations.
 *
 * Tous les champs sont facultatifs, et seuls ceux fournis sont modifiés : la frise ne connaît
 * que la colonne qu'elle édite, et renvoyer l'objet entier lui ferait écraser le reste.
 */
const bodySchema = z.object({
  startDateTime: z.string().datetime().optional(),
  location: z.string().max(191).optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
  isPublic: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const performanceId = validateResourceId(event, 'performanceId', 'performance')

    const allowed = await canManageArtistsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les spectacles de cette édition",
      })
    }

    // La représentation doit appartenir à un spectacle de cette édition : sans ce contrôle,
    // l'identifiant d'une autre édition passerait, l'URL n'étant vérifiée que sur l'édition.
    const performance = await prisma.showPerformance.findFirst({
      where: { id: performanceId, show: { editionId } },
      select: { id: true },
    })
    if (!performance) {
      throw createError({ status: 404, message: 'Représentation introuvable' })
    }

    const body = bodySchema.parse(await readBody(event))

    const data: Record<string, unknown> = {}
    if (body.startDateTime !== undefined) data.startDateTime = new Date(body.startDateTime)
    if (body.location !== undefined) data.location = body.location
    if (body.zoneId !== undefined) data.zoneId = body.zoneId || null
    if (body.markerId !== undefined) data.markerId = body.markerId || null
    if (body.isPublic !== undefined) data.isPublic = body.isPublic

    const updated = await prisma.showPerformance.update({
      where: { id: performanceId },
      data,
      include: showZoneMarkerInclude,
    })

    return createSuccessResponse({ performance: updated })
  },
  { operationName: 'UpdateShowPerformance' }
)
