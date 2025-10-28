import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
    const returnableItems = await prisma.ticketingReturnableItem.findMany({
      where: { editionId },
      orderBy: { name: 'asc' },
    })

    return {
      success: true,
      returnableItems,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch returnable items:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des articles à restituer',
    })
  }
})
