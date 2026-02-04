import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteReturnableItem } from '@@/server/utils/editions/ticketing/returnable-items'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

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

    return await deleteReturnableItem(itemId, editionId)
  },
  { operationName: 'DELETE ticketing returnable item' }
)
