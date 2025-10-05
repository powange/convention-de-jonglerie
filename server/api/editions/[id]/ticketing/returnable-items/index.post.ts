import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { createReturnableItem } from '../../../../../utils/editions/ticketing/returnable-items'

const createItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)
  const validation = createItemSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.errors[0].message,
    })
  }

  try {
    return await createReturnableItem(editionId, validation.data)
  } catch (error: any) {
    console.error('Failed to create returnable item:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la création de l'item à restituer",
    })
  }
})
