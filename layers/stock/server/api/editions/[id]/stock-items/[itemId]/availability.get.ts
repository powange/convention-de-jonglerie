import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock, getReservedQuantityOnPeriod } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-items/[itemId]/availability?at=ISO&until=ISO
 *
 * Retourne la disponibilité d'un objet :
 * - `quantity` : stock total
 * - `reserved` : quantité réservée sur la période [at, until]
 * - `available` : reste disponible
 *
 * Si `at` n'est pas fourni, utilise `new Date()`.
 * Si `until` n'est pas fourni, utilise `at + 1 heure`.
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
      select: { id: true, quantity: true },
    })
    if (!item) {
      throw createError({ status: 404, message: 'Objet introuvable' })
    }

    const query = getQuery(event)
    const at = query.at ? new Date(String(query.at)) : new Date()
    const until = query.until ? new Date(String(query.until)) : new Date(at.getTime() + 3600_000)
    if (isNaN(at.getTime()) || isNaN(until.getTime()) || until <= at) {
      throw createError({ status: 400, message: 'Période invalide' })
    }

    const reserved = await getReservedQuantityOnPeriod(itemId, at, until)
    const available = Math.max(0, item.quantity - reserved)

    return createSuccessResponse({
      quantity: item.quantity,
      reserved,
      available,
      at: at.toISOString(),
      until: until.toISOString(),
    })
  },
  { operationName: 'GetStockItemAvailability' }
)
