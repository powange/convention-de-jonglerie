import { z } from 'zod'

import { remplacerLesQuotas } from '../../../../../../utils/quotas-personnes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/organizers/[editionOrganizerId]/quotas
 *
 * Les quotas que consomme UN organisateur nommé. Remplace l'ensemble.
 *
 * Ces quotas s'ajoutent à ceux de la ligne globale ; ils ne les remplacent pas. Un organisateur
 * peut donc relever d'une jauge commune et d'une jauge qui lui est propre.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const organizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    // L'organisateur doit être inscrit SUR CETTE ÉDITION : sans ce contrôle, on rattacherait la
    // jauge d'une convention à quelqu'un qui n'y figure pas.
    const organisateur = await prisma.editionOrganizer.findFirst({
      where: { id: organizerId, editionId },
      select: { id: true },
    })
    if (!organisateur) {
      throw createError({ status: 404, message: 'Organisateur introuvable sur cette édition' })
    }

    const body = bodySchema.parse(await readBody(event))
    const quotaIds = await remplacerLesQuotas({
      editionId,
      quotaIds: body.quotaIds,
      table: (tx) => tx.editionOrganizerQuota,
      cible: { organizerId },
    })

    return createSuccessResponse({ organizerId, quotaIds })
  },
  { operationName: 'PUT ticketing organizer quotas' }
)
