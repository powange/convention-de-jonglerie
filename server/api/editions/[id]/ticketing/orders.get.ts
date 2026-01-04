import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { validatePagination, validateEditionId } from '@@/server/utils/validation-helpers'

interface CustomFieldAnswer {
  name: string
  answer: string
}

interface CustomFieldFilter {
  name: string
  value: string
}

// Fonction helper pour vérifier si une commande correspond aux filtres customFields
function orderMatchesCustomFieldFilters(
  order: { items: { customFields: unknown }[] },
  filters: CustomFieldFilter[],
  mode: 'and' | 'or' = 'and'
): boolean {
  const matchesFilter = (filter: CustomFieldFilter) =>
    order.items.some((item) => {
      if (!item.customFields || !Array.isArray(item.customFields)) return false
      return (item.customFields as CustomFieldAnswer[]).some(
        (field) => field.name === filter.name && String(field.answer) === filter.value
      )
    })

  // Mode ET : tous les filtres doivent être satisfaits
  // Mode OU : au moins un filtre doit être satisfait
  return mode === 'and' ? filters.every(matchesFilter) : filters.some(matchesFilter)
}

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
    const optionIdsParam = (query.optionIds as string) || ''
    const optionIds = optionIdsParam ? optionIdsParam.split(',').map((id) => parseInt(id)) : []
    const entryStatus = (query.entryStatus as string) || 'all'

    // Parse les filtres de champs personnalisés (format JSON array)
    const customFieldFiltersParam = (query.customFieldFilters as string) || ''
    let customFieldFilters: CustomFieldFilter[] = []
    if (customFieldFiltersParam) {
      try {
        const parsed = JSON.parse(customFieldFiltersParam)
        if (Array.isArray(parsed)) {
          customFieldFilters = parsed.filter(
            (f): f is CustomFieldFilter =>
              typeof f === 'object' && typeof f.name === 'string' && typeof f.value === 'string'
          )
        }
      } catch {
        // Ignorer les erreurs de parsing JSON
      }
    }

    // Mode de filtrage des champs personnalisés (ET ou OU)
    const customFieldFilterMode =
      (query.customFieldFilterMode as string) === 'or' ? 'or' : ('and' as const)

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

      // Ajouter le filtre par options (mode OU - au moins une des options sélectionnées)
      if (optionIds.length > 0) {
        itemsConditions.push({
          selectedOptions: {
            some: {
              optionId: { in: optionIds },
            },
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

      // Vérifier si on doit filtrer par customFields (nécessite filtrage JS)
      const hasCustomFieldFilter = customFieldFilters.length > 0

      // Include commun pour les items
      const itemsInclude = {
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
          selectedOptions: {
            include: {
              option: true,
            },
            orderBy: { id: 'asc' as const },
          },
        },
        orderBy: { id: 'asc' as const },
      }

      let orders: any[]
      let total: number

      if (hasCustomFieldFilter) {
        // Récupérer TOUTES les commandes sans pagination pour filtrer par customFields
        const allOrders = await prisma.ticketingOrder.findMany({
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
            items: itemsInclude,
          },
          orderBy: { orderDate: 'desc' },
        })

        // Filtrer par customFields en JavaScript
        const filteredOrders = allOrders.filter((order) =>
          orderMatchesCustomFieldFilters(order, customFieldFilters, customFieldFilterMode)
        )

        // Calculer le total après filtrage
        total = filteredOrders.length

        // Appliquer la pagination manuellement
        orders = filteredOrders.slice(skip, skip + take)
      } else {
        // Compter le nombre total de commandes
        total = await prisma.ticketingOrder.count({
          where: {
            editionId,
            ...searchCondition,
            ...itemsCondition,
          },
        })

        // Récupérer les commandes paginées
        orders = await prisma.ticketingOrder.findMany({
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
            items: itemsInclude,
          },
          orderBy: { orderDate: 'desc' },
          skip,
          take,
        })
      }

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
            status: true,
            paymentMethod: true,
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

        // Calculer les montants par méthode de paiement
        const amountsByPaymentMethod = allOrders.reduce(
          (acc, order) => {
            const amount = order.amount

            if (order.status === 'Pending') {
              acc.pending += amount
            } else if (order.status === 'Refunded') {
              acc.refunded += amount
            } else if (order.paymentMethod === 'card') {
              acc.card += amount
            } else if (order.paymentMethod === 'cash') {
              acc.cash += amount
            } else if (order.paymentMethod === 'check') {
              acc.check += amount
            } else if (order.status === 'Processed' || order.status === 'Onsite') {
              // Anciennes commandes payées sans méthode spécifique
              acc.online += amount
            }

            return acc
          },
          {
            card: 0,
            cash: 0,
            check: 0,
            online: 0,
            pending: 0,
            refunded: 0,
          }
        )

        stats = {
          totalOrders: total,
          totalItems,
          totalAmount,
          totalDonations,
          totalDonationsAmount,
          amountsByPaymentMethod,
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
