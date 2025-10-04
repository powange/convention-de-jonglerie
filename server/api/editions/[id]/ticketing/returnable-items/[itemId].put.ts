import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

const updateItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const itemId = parseInt(getRouterParam(event, 'itemId') || '0')

  if (!editionId || !itemId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.returnableItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ statusCode: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      statusCode: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  const body = await readBody(event)
  const validation = updateItemSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.errors[0].message,
    })
  }

  try {
    const item = await prisma.returnableItem.update({
      where: { id: itemId },
      data: {
        name: validation.data.name,
      },
    })

    return item
  } catch (error: any) {
    console.error('Failed to update returnable item:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la modification de l'item à restituer",
    })
  }
})
