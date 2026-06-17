import { requireAuth } from '#server/utils/auth-utils'
import { deleteHandoutItem } from '#server/utils/editions/ticketing/handout-items'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'item')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    return createSuccessResponse(await deleteHandoutItem(itemId, editionId))
  },
  { operationName: 'DELETE ticketing handout item' }
)
