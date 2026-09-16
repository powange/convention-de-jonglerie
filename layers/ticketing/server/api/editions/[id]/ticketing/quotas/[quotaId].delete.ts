import { assertQuotasDeLEdition } from '../../../../../utils/quotas-appartenance'

import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const quotaId = validateResourceId(event, 'quotaId', 'quota')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    await assertQuotasDeLEdition(editionId, [quotaId])

    await prisma.ticketingQuota.delete({
      where: { id: quotaId },
    })

    return createSuccessResponse(null)
  },
  { operationName: 'DELETE ticketing quota' }
)
