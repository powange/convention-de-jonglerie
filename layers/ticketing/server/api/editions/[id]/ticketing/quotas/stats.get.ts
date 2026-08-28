import { requireAuth } from '#server/utils/auth-utils'
import { getQuotaStats } from '#server/utils/editions/ticketing/quota-stats'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès :
    // c'est à l'entrée qu'on inscrit un arrivant et qu'on regarde si un tarif est complet)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      const stats = await getQuotaStats(editionId)
      return { stats }
    } catch (error: unknown) {
      console.error('Failed to fetch quota stats:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des statistiques des quotas',
      })
    }
  },
  { operationName: 'GET ticketing quotas stats' }
)
