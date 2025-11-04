import { requireAuth } from '@@/server/utils/auth-utils'
import { getReturnableItems } from '@@/server/utils/editions/ticketing/returnable-items'
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
    return await getReturnableItems(editionId)
  } catch (error: unknown) {
    console.error('Failed to fetch returnable items:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des items à restituer',
    })
  }
  },
  { operationName: 'GET ticketing returnable-items index' }
)
