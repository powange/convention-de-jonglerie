import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import {
  verifierRepereDeLEdition,
  verifierZoneDeLEdition,
} from '#server/utils/appartenance-a-l-edition'
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
    /*
     * ⚠️ LA ZONE ET LE REPÈRE SONT VÉRIFIÉS, et la garde du dessus n'y suffisait PAS. Elle prouve
     * que la REPRÉSENTATION appartient à l'édition (`show: { editionId } }`) — pas que les
     * identifiants qu'on lui affecte y appartiennent aussi.
     *
     * Une représentation de cette édition pouvait donc pointer la zone ou le repère d'une AUTRE :
     * le public voyait sur son plan un lieu qui n'existe pas chez lui, ou le nom d'un lieu d'une
     * autre convention. Aucune erreur, aucune trace — la zone existe, elle a un nom.
     *
     * `null` reste permis : c'est ainsi qu'on détache une représentation de son lieu.
     */
    if (body.zoneId !== undefined) {
      await verifierZoneDeLEdition(prisma, editionId, body.zoneId)
      data.zoneId = body.zoneId || null
    }
    if (body.markerId !== undefined) {
      await verifierRepereDeLEdition(prisma, editionId, body.markerId)
      data.markerId = body.markerId || null
    }
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
