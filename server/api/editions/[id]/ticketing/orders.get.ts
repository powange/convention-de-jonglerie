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

  // Paramètres de pagination
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const search = (query.search as string) || ''

  try {
    // Récupérer la configuration de billeterie externe
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      select: { id: true },
    })

    if (!config) {
      return {
        orders: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      }
    }

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

    // Compter le nombre total de commandes
    const total = await prisma.ticketingOrder.count({
      where: {
        externalTicketingId: config.id,
        ...searchCondition,
      },
    })

    // Récupérer les commandes paginées
    const orders = await prisma.ticketingOrder.findMany({
      where: {
        externalTicketingId: config.id,
        ...searchCondition,
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
      skip: (page - 1) * limit,
      take: limit,
    })

    // Calculer les stats globales (seulement si pas de recherche pour optimiser)
    let stats = null
    if (!search) {
      const allOrders = await prisma.ticketingOrder.findMany({
        where: { externalTicketingId: config.id },
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
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch orders from DB:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des commandes',
    })
  }
})
