import { createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const quotaId = validateResourceId(event, 'quotaId', 'quota')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    // Vérifier que le quota existe et appartient à cette édition
    const existingQuota = await prisma.ticketingQuota.findUnique({
      where: { id: quotaId },
    })

    if (!existingQuota) {
      throw createError({ status: 404, message: 'Quota introuvable' })
    }

    if (existingQuota.editionId !== editionId) {
      throw createError({
        status: 403,
        message: "Ce quota n'appartient pas à cette édition",
      })
    }

    await prisma.ticketingQuota.delete({
      where: { id: quotaId },
    })

    return createSuccessResponse(null)
  },
  { operationName: 'DELETE ticketing quota' }
)
