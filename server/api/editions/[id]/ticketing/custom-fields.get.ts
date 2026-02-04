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
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

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
  },
  { operationName: 'GET ticketing custom fields' }
)
