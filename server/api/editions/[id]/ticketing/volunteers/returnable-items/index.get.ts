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
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const items = await prisma.editionVolunteerReturnableItem.findMany({
        where: { editionId },
        include: {
          returnableItem: true,
          team: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: [
          {
            teamId: 'asc', // NULL en premier (global), puis les équipes
          },
          {
            returnableItem: {
              name: 'asc',
            },
          },
        ],
      })

      return {
        items: items.map((item) => ({
          id: item.id,
          returnableItemId: item.returnableItemId,
          teamId: item.teamId,
          name: item.returnableItem.name,
          team: item.team,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      }
    } catch (error: unknown) {
      console.error(
        'Erreur lors de la récupération des articles à restituer pour bénévoles:',
        error
      )
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des articles',
      })
    }
  },
  { operationName: 'GET ticketing volunteers returnable-items index' }
)
