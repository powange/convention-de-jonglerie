import { requireAuth } from '#server/utils/auth-utils'
import { getHandoutItems } from '#server/utils/editions/ticketing/handout-items'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      return await getHandoutItems(editionId)
    } catch (error: unknown) {
      console.error('Failed to fetch handout items:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des items à remettre',
      })
    }
  },
  { operationName: 'GET ticketing handout-items index' }
)
