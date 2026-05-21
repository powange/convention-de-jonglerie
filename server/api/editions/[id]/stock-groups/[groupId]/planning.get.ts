import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-groups/[groupId]/planning
 *
 * Retourne les items d'un groupe avec toutes leurs réservations actives
 * (RESERVED ou PICKED_UP), pour alimenter une vue timeline/Gantt.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const group = await prisma.stockGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const items = await prisma.stockItem.findMany({
      where: { stockGroupId: groupId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        quantity: true,
        location: true,
        zone: { select: { id: true, name: true, color: true } },
        marker: { select: { id: true, name: true } },
        reservations: {
          where: { status: { in: ['RESERVED', 'PICKED_UP'] } },
          orderBy: { startsAt: 'asc' },
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            quantityReserved: true,
            usage: true,
            location: true,
            zone: { select: { id: true, name: true, color: true } },
            marker: { select: { id: true, name: true } },
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({ items })
  },
  { operationName: 'GetStockGroupPlanning' }
)
