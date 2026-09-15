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
 * PUT /api/editions/[id]/ticketing/organizers/quotas
 *
 * Les quotas que consomme TOUT organisateur de l'édition. Remplace l'ensemble.
 *
 * Le pendant de la ligne globale des articles à remettre : ce qui vaut pour tout le monde se règle
 * une fois, au lieu d'être répété sur chaque organisateur — et reste juste quand un organisateur
 * est ajouté après coup.
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
      table: (tx) => tx.editionOrganizerQuota,
      cible: { organizerId: null },
    })

    return createSuccessResponse({ organizerId: null, quotaIds })
  },
  { operationName: 'PUT ticketing organizer quotas (global)' }
)
