import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const quotaId = validateResourceId(event, 'quotaId', 'quota')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    // Vérifier que le quota existe et appartient à cette édition
    const existingQuota = await prisma.ticketingQuota.findUnique({
      where: { id: quotaId },
    })

    if (!existingQuota) {
      throw createError({ statusCode: 404, message: 'Quota introuvable' })
    }

    if (existingQuota.editionId !== editionId) {
      throw createError({
        statusCode: 403,
        message: "Ce quota n'appartient pas à cette édition",
      })
    }

    await prisma.ticketingQuota.delete({
      where: { id: quotaId },
    })

    return { success: true }
  },
  { operationName: 'DELETE ticketing quota' }
)
