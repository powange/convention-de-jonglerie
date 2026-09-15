import { z } from 'zod'

import { remplacerLesQuotas } from '../../../../../utils/quotas-personnes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/artists/quotas
 *
 * Les quotas que consomme TOUT artiste de l'édition. Remplace l'ensemble.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const body = bodySchema.parse(await readBody(event))
    const quotaIds = await remplacerLesQuotas({
      editionId,
      quotaIds: body.quotaIds,
      table: (tx) => tx.editionArtistQuota,
      cible: { showId: null },
    })

    return createSuccessResponse({ showId: null, quotaIds })
  },
  { operationName: 'PUT ticketing artist quotas (global)' }
)
