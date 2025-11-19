import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      const quotas = await prisma.ticketingQuota.findMany({
        where: { editionId },
        orderBy: { position: 'asc' },
      })

      return quotas
    } catch (error: unknown) {
      console.error('Failed to fetch quotas:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des quotas',
      })
    }
  },
  { operationName: 'GET ticketing quotas index' }
)
