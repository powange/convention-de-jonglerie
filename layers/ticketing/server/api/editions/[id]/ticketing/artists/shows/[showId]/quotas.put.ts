import { z } from 'zod'

import { remplacerLesQuotas } from '../../../../../../../utils/quotas-personnes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/artists/shows/[showId]/quotas
 *
 * Les quotas que consomment les artistes d'UN spectacle. Remplace l'ensemble.
 *
 * Le rattachement passe par le spectacle et non par l'artiste, pour reprendre l'écran des
 * articles à remettre. Un artiste qui joue dans deux spectacles associés au même quota n'y occupe
 * qu'une place : le dédoublonnage porte sur la personne, pas sur l'association.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showId = validateResourceId(event, 'showId', 'spectacle')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const spectacle = await prisma.show.findFirst({
      where: { id: showId, editionId },
      select: { id: true },
    })
    if (!spectacle) {
      throw createError({ status: 404, message: 'Spectacle introuvable sur cette édition' })
    }

    const body = bodySchema.parse(await readBody(event))
    const quotaIds = await remplacerLesQuotas({
      editionId,
      quotaIds: body.quotaIds,
      table: (tx) => tx.editionArtistQuota,
      cible: { showId },
    })

    return createSuccessResponse({ showId, quotaIds })
  },
  { operationName: 'PUT ticketing artist show quotas' }
)
