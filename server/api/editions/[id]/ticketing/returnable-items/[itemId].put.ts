import { z } from 'zod'

import { requireAuth } from '../../../../../../utils/auth-utils'
import { updateReturnableItem } from '../../../../../utils/editions/ticketing/returnable-items'
import { canAccessEditionData } from '../../../../../utils/permissions/edition-permissions'

const updateItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const itemId = parseInt(getRouterParam(event, 'itemId') || '0')

  if (!editionId || !itemId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)
  const validation = updateItemSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.errors[0].message,
    })
  }

  try {
    return await updateReturnableItem(itemId, editionId, validation.data)
  } catch (error: any) {
    console.error('Failed to update returnable item:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la modification de l'item à restituer",
    })
  }
})
