import { requireAuth } from '@@/server/utils/auth-utils'
import { createReturnableItem } from '@@/server/utils/editions/ticketing/returnable-items'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { z } from 'zod'

const createItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    const body = await readBody(event)
    const validation = createItemSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        message: validation.error.errors[0].message,
      })
    }

    try {
      return await createReturnableItem(editionId, validation.data)
    } catch (error: unknown) {
      console.error('Failed to create returnable item:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de la création de l'item à restituer",
      })
    }
  },
  { operationName: 'POST ticketing returnable-items index' }
)
