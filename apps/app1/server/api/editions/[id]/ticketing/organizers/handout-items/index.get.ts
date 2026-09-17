import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const rawItems = await prisma.editionOrganizerHandoutItem.findMany({
        where: { editionId },
        include: {
          handoutItem: { select: { id: true, name: true } },
          organizer: {
            select: {
              id: true,
              organizer: {
                select: {
                  user: {
                    select: {
                      id: true,
                      pseudo: true,
                      nom: true,
                      prenom: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          {
            organizerId: 'asc', // NULL en premier (global), puis les organisateurs
          },
        ],
      })

      return {
        items: rawItems.map((item) => ({
          id: item.id,
          handoutItemId: item.handoutItemId,
          handoutItemName: item.handoutItem.name,
          quantity: item.quantity,
          organizerId: item.organizerId,
          organizer: item.organizer
            ? {
                id: item.organizer.id,
                user: item.organizer.organizer.user,
              }
            : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      }
    } catch (error: unknown) {
      console.error(
        'Erreur lors de la récupération des articles à remettre pour organisateurs:',
        error
      )
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des articles',
      })
    }
  },
  { operationName: 'GET ticketing organizers handout-items index' }
)
