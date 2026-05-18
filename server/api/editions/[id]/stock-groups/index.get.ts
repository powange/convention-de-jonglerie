import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-groups
 *
 * Liste les groupes de stock d'une édition avec leurs items.
 * Accessible aux organisateurs avec `canManageStock` et aux team leaders bénévoles.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const groups = await prisma.stockGroup.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            zone: { select: { id: true, name: true, color: true } },
            marker: { select: { id: true, name: true } },
            _count: { select: { reservations: true } },
          },
        },
      },
    })

    return createSuccessResponse({ groups })
  },
  { operationName: 'GetStockGroups' }
)
