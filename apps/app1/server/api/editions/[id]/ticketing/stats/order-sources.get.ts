import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketing } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = parseInt(getRouterParam(event, 'id') || '0')
    const query = getQuery(event)
    const tierIds = query.tierIds
      ? (Array.isArray(query.tierIds) ? query.tierIds : [query.tierIds]).map(Number)
      : null

    if (!editionId || isNaN(editionId)) {
      throw createError({
        status: 400,
        message: "ID d'édition invalide",
      })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: {
              where: {
                userId: user.id,
              },
            },
          },
        },
        organizerPermissions: {
          where: {
            organizer: {
              userId: user.id,
            },
          },
          include: {
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Edition not found',
      })
    }

    if (!canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour consulter ces statistiques",
      })
    }

    const orders = await prisma.ticketingOrder.findMany({
      where: {
        editionId,
      },
      select: {
        id: true,
        helloAssoOrderId: true,
        items: {
          where: tierIds
            ? {
                tierId: {
                  in: tierIds,
                },
              }
            : undefined,
          select: {
            id: true,
          },
        },
      },
    })

    let manualItems = 0
    let externalItems = 0
    let manualOrders = 0
    let externalOrders = 0

    orders.forEach((order) => {
      const itemCount = order.items.length
      if (order.helloAssoOrderId === null) {
        manualItems += itemCount
        manualOrders++
      } else {
        externalItems += itemCount
        externalOrders++
      }
    })

    return {
      items: {
        manual: manualItems,
        external: externalItems,
        total: manualItems + externalItems,
      },
      orders: {
        manual: manualOrders,
        external: externalOrders,
        total: manualOrders + externalOrders,
      },
    }
  },
  { operationName: 'GetTicketingOrderSources' }
)
