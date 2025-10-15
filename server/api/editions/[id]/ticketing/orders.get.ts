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
    // Récupérer la configuration de billeterie externe
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        orders: {
          include: {
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
        },
      },
    })

    if (!config) {
      return {
        orders: [],
      }
    }

    return {
      orders: config.orders,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch orders from DB:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des commandes',
    })
  }
})
