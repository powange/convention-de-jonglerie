import { requireAuth } from '@@/server/utils/auth-utils'
import { getEditionOptions } from '@@/server/utils/editions/ticketing/options'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

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

    return await getEditionOptions(editionId)
  },
  { operationName: 'GET ticketing options' }
)
