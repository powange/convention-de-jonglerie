import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const items = await prisma.editionVolunteerHandoutItem.findMany({
        where: { editionId },
        include: {
          handoutItem: true,
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
            handoutItem: {
              name: 'asc',
            },
          },
        ],
      })

      return {
        items: items.map((item) => ({
          id: item.id,
          handoutItemId: item.handoutItemId,
          teamId: item.teamId,
          name: item.handoutItem.name,
          team: item.team,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la récupération des articles à remettre pour bénévoles:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des articles',
      })
    }
  },
  { operationName: 'GET ticketing volunteers handout-items index' }
)
