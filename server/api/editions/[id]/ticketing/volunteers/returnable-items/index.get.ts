import { canAccessEditionData } from '../../../../../../utils/edition-permissions'
import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    const items = await prisma.editionVolunteerReturnableItem.findMany({
      where: { editionId },
      include: {
        returnableItem: true,
      },
      orderBy: {
        returnableItem: {
          name: 'asc',
        },
      },
    })

    return {
      items: items.map((item) => ({
        id: item.id,
        returnableItemId: item.returnableItemId,
        name: item.returnableItem.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des articles à restituer pour bénévoles:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des articles',
    })
  }
})
