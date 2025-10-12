import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  returnableItemId: z.number(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les articles à restituer',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que l'article à restituer existe et appartient à l'édition
    const returnableItem = await prisma.ticketingReturnableItem.findFirst({
      where: {
        id: body.returnableItemId,
        editionId,
      },
    })

    if (!returnableItem) {
      throw createError({
        statusCode: 404,
        message: 'Article à restituer introuvable',
      })
    }

    // Vérifier que l'association n'existe pas déjà
    const existing = await prisma.editionVolunteerReturnableItem.findUnique({
      where: {
        editionId_returnableItemId: {
          editionId,
          returnableItemId: body.returnableItemId,
        },
      },
    })

    if (existing) {
      throw createError({
        statusCode: 400,
        message: 'Cet article est déjà associé aux bénévoles',
      })
    }

    // Créer l'association
    const item = await prisma.editionVolunteerReturnableItem.create({
      data: {
        editionId,
        returnableItemId: body.returnableItemId,
      },
      include: {
        returnableItem: true,
      },
    })

    return {
      success: true,
      item: {
        id: item.id,
        returnableItemId: item.returnableItemId,
        name: item.returnableItem.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    }
  } catch (error: any) {
    console.error("Erreur lors de l'ajout de l'article pour bénévoles:", error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'ajout de l'article",
    })
  }
})
