import { requireAuth } from '@@/server/utils/auth-utils'
import { getQuotaStats } from '@@/server/utils/editions/ticketing/quota-stats'
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
    const stats = await getQuotaStats(editionId)
    return { stats }
  } catch (error: unknown) {
    console.error('Failed to fetch quota stats:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des statistiques des quotas',
    })
  }
  },
  { operationName: 'GET ticketing quotas stats' }
)
