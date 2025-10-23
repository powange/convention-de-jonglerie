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
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    const customFields = await prisma.ticketingTierCustomField.findMany({
      where: { editionId },
      include: {
        tiers: {
          include: {
            tier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        quotas: {
          include: {
            quota: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        returnableItems: {
          include: {
            returnableItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return customFields
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des custom fields:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des custom fields',
    })
  }
})
