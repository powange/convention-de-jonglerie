import { requireAuth } from '@@/server/utils/auth-utils'
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
        status: 500,
        message: 'Erreur lors de la récupération des articles à restituer',
      })
    }
  },
  { operationName: 'GET ticketing returnable-items' }
)
