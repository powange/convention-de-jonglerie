import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { MESSAGE_QUANTITE_MAX, QUANTITE_MAX_STOCK } from '#server/utils/quantite-stock'
import {
  canAccessStock,
  getReservedQuantityOnPeriod,
  validateReservationLocation,
} from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const RESERVATION_STATUSES = ['RESERVED', 'PICKED_UP', 'RETURNED', 'CANCELLED'] as const

const bodySchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  usage: z.string().trim().min(1).max(500).optional(),
  quantityReserved: z
    .number()
    .int()
    .positive()
    .max(QUANTITE_MAX_STOCK, MESSAGE_QUANTITE_MAX)
    .optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  markerId: z.number().int().positive().nullable().optional(),
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

    // Une annulation ne consomme rien : elle n'a pas de disponibilité à vérifier.
    const newStatus = data.status ?? reservation.status
    const isActiveStatus = newStatus === 'RESERVED' || newStatus === 'PICKED_UP'

    // Validation cross-champ de l'emplacement : si l'un des 3 champs est
    // touché, on vérifie que la combinaison finale (merge avec l'existant)
    // contient bien au moins une indication de lieu et qu'on ne mixe pas
    // zone et marqueur sur la même réservation.
    const touchedLocation =
      data.location !== undefined || data.zoneId !== undefined || data.markerId !== undefined
    if (touchedLocation) {
      const finalLocation =
        data.location !== undefined ? data.location?.trim() : reservation.location?.trim()
      const finalZoneId = data.zoneId !== undefined ? data.zoneId : reservation.zoneId
      const finalMarkerId = data.markerId !== undefined ? data.markerId : reservation.markerId
      if (!finalLocation && !finalZoneId && !finalMarkerId) {
        throw createError({
          status: 400,
          message: 'Indiquez où le matériel doit être amené (texte ou emplacement de la carte)',
        })
      }
      if (finalZoneId && finalMarkerId) {
        throw createError({
          status: 400,
          message: 'Une réservation ne peut pas cibler à la fois une zone et un marqueur',
        })
      }
    }

    // Vérifier zone/marker s'ils ont été fournis
    await validateReservationLocation(
      {
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
      },
      editionId
    )

    const updateData: Record<string, unknown> = {}
    if (data.startsAt !== undefined) updateData.startsAt = newStartsAt
    if (data.endsAt !== undefined) updateData.endsAt = newEndsAt
    if (data.usage !== undefined) updateData.usage = data.usage
    if (data.quantityReserved !== undefined) updateData.quantityReserved = newQuantity
    if (data.status !== undefined) updateData.status = data.status
    if (data.location !== undefined) updateData.location = data.location?.trim() || null
    if (data.zoneId !== undefined) updateData.zoneId = data.zoneId
    if (data.markerId !== undefined) updateData.markerId = data.markerId

    /*
     * Le relevé de disponibilité et l'écriture tiennent dans la même transaction, comme dans la
     * réservation en lot. La réservation modifiée est exclue du relevé : elle libère ce qu'elle
     * occupait déjà.
     *
     * Ce que cela apporte, et rien de plus : la fenêtre entre le relevé et l'écriture se resserre.
     * Elle ne se ferme pas. Aucun verrou n'est posé sur l'objet, si bien que deux transactions
     * concurrentes peuvent encore lire le même total et accorder toutes deux le dernier
     * exemplaire. Fermer vraiment demanderait un verrou de ligne au moment du relevé — un
     * `SELECT … FOR UPDATE` sur l'objet —, ce que Prisma n'exprime qu'en SQL brut.
     */
    const updated = await prisma.$transaction(async (tx) => {
      if (isActiveStatus) {
        const alreadyReserved = await getReservedQuantityOnPeriod(
          reservation.stockItemId,
          newStartsAt,
          newEndsAt,
          reservation.id,
          tx
        )
        const available = reservation.stockItem.quantity - alreadyReserved
        if (newQuantity > available) {
          throw createError({
            status: 409,
            message: `Quantité indisponible : seulement ${available} sur ${reservation.stockItem.quantity} sur la période demandée`,
          })
        }
      }

      return tx.stockReservation.update({
        where: { id: reservationId },
        data: updateData,
        include: {
          zone: { select: { id: true, name: true, color: true } },
          marker: { select: { id: true, name: true } },
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
    })

    return createSuccessResponse({ reservation: updated })
  },
  { operationName: 'UpdateStockReservation' }
)
