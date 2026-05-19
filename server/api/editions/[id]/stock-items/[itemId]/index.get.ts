import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock, stockItemLocationsInclude } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-items/[itemId]
 *
 * Détail d'un item de stock avec ses réservations actives et futures.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (isNaN(itemId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const item = await prisma.stockItem.findFirst({
      where: { id: itemId, group: { editionId } },
      include: {
        group: { select: { id: true, name: true } },
        locations: stockItemLocationsInclude,
        reservations: {
          orderBy: { startsAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                email: true,
                emailHash: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    })
    if (!item) {
      throw createError({ status: 404, message: 'Objet introuvable' })
    }

    return createSuccessResponse({ item })
  },
  { operationName: 'GetStockItem' }
)
