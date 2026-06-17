import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/stock-reservations/[reservationId]
 *
 * Supprime une réservation. Autorisé pour :
 * - l'auteur de la réservation
 * - les organisateurs avec `canManageStock` (modération)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const reservationId = Number(getRouterParam(event, 'reservationId'))
    if (isNaN(reservationId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const reservation = await prisma.stockReservation.findFirst({
      where: {
        id: reservationId,
        stockItem: { group: { editionId } },
      },
      select: { userId: true },
    })
    if (!reservation) {
      throw createError({ status: 404, message: 'Réservation introuvable' })
    }

    const isAuthor = reservation.userId === user.id
    const isModerator = canManageStock(edition, user)
    if (!isAuthor && !isModerator) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    await prisma.stockReservation.delete({ where: { id: reservationId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteStockReservation' }
)
