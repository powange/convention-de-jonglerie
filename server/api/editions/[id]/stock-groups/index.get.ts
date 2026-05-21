import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock, stockItemLocationsInclude } from '#server/utils/stock-helpers'
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

    const now = new Date()
    const groups = await prisma.stockGroup.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            locations: stockItemLocationsInclude,
            _count: { select: { reservations: true } },
            // Réservation à afficher : en cours, en retard (PICKED_UP non
            // rendue après endsAt) ou la prochaine à venir.
            // - RESERVED : exclure les réservations terminées (endsAt < now)
            // - PICKED_UP : toujours inclure tant que pas RETURNED (le retard
            //   est précisément le cas à signaler)
            // L'ordre asc sur startsAt place les en-cours/retard en tête
            // (leur startsAt est dans le passé).
            reservations: {
              where: {
                OR: [{ status: 'RESERVED', endsAt: { gt: now } }, { status: 'PICKED_UP' }],
              },
              orderBy: { startsAt: 'asc' },
              take: 1,
              select: {
                id: true,
                status: true,
                startsAt: true,
                endsAt: true,
                quantityReserved: true,
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({ groups })
  },
  { operationName: 'GetStockGroups' }
)
