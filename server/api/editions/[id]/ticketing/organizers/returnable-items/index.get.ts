import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

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
      // Malheureusement, on ne peut pas utiliser include car il n'y a pas de relation
      // returnableItem dans EditionOrganizerReturnableItem
      // On doit donc récupérer manuellement les données
      const rawItems = await prisma.editionOrganizerReturnableItem.findMany({
        where: { editionId },
        include: {
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

      // Récupérer les IDs uniques des articles
      const returnableItemIds = [...new Set(rawItems.map((item) => item.returnableItemId))]

      // Récupérer tous les articles en une seule requête
      const returnableItems = await prisma.ticketingReturnableItem.findMany({
        where: {
          id: { in: returnableItemIds },
        },
        select: {
          id: true,
          name: true,
        },
      })

      // Créer un map pour un accès rapide
      const returnableItemsMap = new Map(returnableItems.map((item) => [item.id, item.name]))

      return {
        items: rawItems.map((item) => ({
          id: item.id,
          returnableItemId: item.returnableItemId,
          returnableItemName: returnableItemsMap.get(item.returnableItemId) ?? 'Article inconnu',
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
        'Erreur lors de la récupération des articles à restituer pour organisateurs:',
        error
      )
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des articles',
      })
    }
  },
  { operationName: 'GET ticketing organizers returnable-items index' }
)
