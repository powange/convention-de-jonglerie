import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { canAccessStock, getReservedQuantityOnPeriod } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const RESERVATION_STATUSES = ['RESERVED', 'PICKED_UP', 'RETURNED', 'CANCELLED'] as const

const bodySchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  usage: z.string().trim().min(1).max(500).optional(),
  quantityReserved: z.number().int().positive().optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
})

/**
 * PUT /api/editions/[id]/stock-reservations/[reservationId]
 *
 * Modifie une réservation. Autorisé pour :
 * - l'auteur de la réservation (sur tous les champs)
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
      include: { stockItem: { select: { id: true, quantity: true } } },
    })
    if (!reservation) {
      throw createError({ status: 404, message: 'Réservation introuvable' })
    }

    const isAuthor = reservation.userId === user.id
    const isModerator = canManageStock(edition, user)
    if (!isAuthor && !isModerator) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const newStartsAt = data.startsAt ? new Date(data.startsAt) : reservation.startsAt
    const newEndsAt = data.endsAt ? new Date(data.endsAt) : reservation.endsAt
    const newQuantity = data.quantityReserved ?? reservation.quantityReserved
    if (newEndsAt <= newStartsAt) {
      throw createError({
        status: 400,
        message: 'La date de fin doit être après la date de début',
      })
    }

    // Si on change quantité / période ET que ce n'est pas une annulation,
    // vérifier la disponibilité (en excluant la réservation actuelle).
    const newStatus = data.status ?? reservation.status
    const isActiveStatus = newStatus === 'RESERVED' || newStatus === 'PICKED_UP'
    if (isActiveStatus) {
      const alreadyReserved = await getReservedQuantityOnPeriod(
        reservation.stockItemId,
        newStartsAt,
        newEndsAt,
        reservation.id
      )
      const available = reservation.stockItem.quantity - alreadyReserved
      if (newQuantity > available) {
        throw createError({
          status: 409,
          message: `Quantité indisponible : seulement ${available} sur ${reservation.stockItem.quantity} sur la période demandée`,
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.startsAt !== undefined) updateData.startsAt = newStartsAt
    if (data.endsAt !== undefined) updateData.endsAt = newEndsAt
    if (data.usage !== undefined) updateData.usage = data.usage
    if (data.quantityReserved !== undefined) updateData.quantityReserved = newQuantity
    if (data.status !== undefined) updateData.status = data.status

    const updated = await prisma.stockReservation.update({
      where: { id: reservationId },
      data: updateData,
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
    })

    return createSuccessResponse({ reservation: updated })
  },
  { operationName: 'UpdateStockReservation' }
)
