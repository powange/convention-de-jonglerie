import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { validatePagination, validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    // Paramètres de pagination et filtres
    const query = getQuery(event)
    const { page, limit, skip, take } = validatePagination(event)
    const search = (query.search as string) || ''
    const tierIdsParam = (query.tierIds as string) || ''
    const tierIds = tierIdsParam ? tierIdsParam.split(',').map((id) => parseInt(id)) : []
    const entryStatus = (query.entryStatus as string) || 'all'

    try {
      // Construire la condition de recherche
      const searchCondition = search
        ? {
            OR: [
              { payerFirstName: { contains: search } },
              { payerLastName: { contains: search } },
              { payerEmail: { contains: search } },
              {
                items: {
                  some: {
                    OR: [
                      { name: { contains: search } },
                      { firstName: { contains: search } },
                      { lastName: { contains: search } },
                      { email: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}

      // Construire la condition de filtre combinée pour les items
      const itemsConditions: any[] = []

      // Ajouter le filtre par tarifs si nécessaire
      if (tierIds.length > 0) {
        itemsConditions.push({
          tierId: {
            in: tierIds,
          },
        })
      }

      // Ajouter le filtre par statut d'entrée si nécessaire
      if (entryStatus === 'validated') {
        itemsConditions.push({
          entryValidated: true,
        })
      } else if (entryStatus === 'not_validated') {
        itemsConditions.push({
          entryValidated: {
            not: true,
          },
        })
      }

      // Construire la condition finale pour les items
      const itemsCondition =
        itemsConditions.length > 0
          ? {
              items: {
                some:
                  itemsConditions.length === 1
                    ? itemsConditions[0]
                    : {
                        AND: itemsConditions,
                      },
              },
            }
          : {}

      // Compter le nombre total de commandes (toutes les commandes de l'édition)
      const total = await prisma.ticketingOrder.count({
        where: {
          editionId,
          ...searchCondition,
          ...itemsCondition,
        },
      })

      // Récupérer les commandes paginées (toutes les commandes de l'édition)
      const orders = await prisma.ticketingOrder.findMany({
        where: {
          editionId,
          ...searchCondition,
          ...itemsCondition,
        },
        include: {
          externalTicketing: {
            select: {
              provider: true,
            },
          },
          items: {
            include: {
              tier: {
                include: {
                  returnableItems: {
                    include: {
                      returnableItem: true,
                    },
                  },
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take,
      })

      // Calculer les stats globales en tenant compte des filtres
      let stats = null
      if (!search) {
        const allOrders = await prisma.ticketingOrder.findMany({
          where: {
            editionId,
            ...itemsCondition,
          },
          select: {
            amount: true,
            items: {
              select: {
                type: true,
                amount: true,
              },
            },
          },
        })

        const totalItems = allOrders.reduce((sum, order) => {
          const ticketItems = order.items.filter((item) => item.type !== 'Donation')
          return sum + ticketItems.length
        }, 0)

        const totalAmount = allOrders.reduce((sum, order) => sum + order.amount, 0)

        const totalDonations = allOrders.reduce((sum, order) => {
          const donations = order.items.filter((item) => item.type === 'Donation')
          return sum + donations.length
        }, 0)

        const totalDonationsAmount = allOrders.reduce((sum, order) => {
          const donations = order.items.filter((item) => item.type === 'Donation')
          return sum + donations.reduce((itemSum, item) => itemSum + item.amount, 0)
        }, 0)

        stats = {
          totalOrders: total,
          totalItems,
          totalAmount,
          totalDonations,
          totalDonationsAmount,
        }
      }

      return {
        ...createPaginatedResponse(orders, total, page, limit),
        stats,
      }
    } catch (error: unknown) {
      console.error('Failed to fetch orders from DB:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des commandes',
      })
    }
  },
  { operationName: 'GET ticketing orders' }
)
