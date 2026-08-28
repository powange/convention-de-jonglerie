import { requireAuth } from '#server/utils/auth-utils'
import { getEditionTiers } from '#server/utils/editions/ticketing/tiers'
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

    // Pour l'administration des tiers, on retourne les deux noms
    const tiers = await getEditionTiers(editionId, { includeOriginalName: true })
    return createSuccessResponse({ tiers })
  },
  { operationName: 'GET ticketing tiers' }
)
