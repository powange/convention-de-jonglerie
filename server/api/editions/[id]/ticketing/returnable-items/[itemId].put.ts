import { requireAuth } from '@@/server/utils/auth-utils'
import { updateReturnableItem } from '@@/server/utils/editions/ticketing/returnable-items'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { z } from 'zod'

const updateItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})

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

    const body = await readBody(event)
    const validation = updateItemSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        message: validation.error.errors[0].message,
      })
    }

    return await updateReturnableItem(itemId, editionId, validation.data)
  },
  { operationName: 'PUT ticketing returnable item' }
)
