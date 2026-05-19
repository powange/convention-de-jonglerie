import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import {
  canAccessStock,
  getReservedQuantityOnPeriod,
  validateReservationLocation,
} from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    usage: z.string().trim().min(1, "L'utilisation est requise").max(500),
    quantityReserved: z.number().int().positive().default(1),
    // Emplacement d'utilisation : au moins l'un des trois est requis
    location: z.string().trim().max(200).nullable().optional(),
    zoneId: z.number().int().positive().nullable().optional(),
    markerId: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => !!(data.location?.trim() || data.zoneId || data.markerId), {
    message: 'Indiquez où le matériel doit être amené (texte ou emplacement de la carte)',
    path: ['location'],
  })
  .refine((data) => !(data.zoneId && data.markerId), {
    message: 'Une réservation ne peut pas cibler à la fois une zone et un marqueur',
    path: ['zoneId'],
  })

/**
 * POST /api/editions/[id]/stock-items/[itemId]/reservations
 *
 * Crée une réservation pour un objet. Accessible aux utilisateurs avec
 * `canManageStock` ou aux team leaders bénévoles.
 *
 * Vérifie que la quantité demandée est disponible sur la période demandée.
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

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const startsAt = new Date(data.startsAt)
    const endsAt = new Date(data.endsAt)
    if (endsAt <= startsAt) {
      throw createError({
        status: 400,
        message: 'La date de fin doit être après la date de début',
      })
    }

    if (data.quantityReserved > item.quantity) {
      throw createError({
        status: 400,
        message: `Quantité demandée (${data.quantityReserved}) supérieure au stock total (${item.quantity})`,
      })
    }

    const alreadyReserved = await getReservedQuantityOnPeriod(itemId, startsAt, endsAt)
    const available = item.quantity - alreadyReserved
    if (data.quantityReserved > available) {
      throw createError({
        status: 409,
        message: `Quantité indisponible : seulement ${available} sur ${item.quantity} sur la période demandée`,
      })
    }

    // Vérifier que zone/marker, si fournis, appartiennent à l'édition.
    await validateReservationLocation(
      { zoneId: data.zoneId ?? null, markerId: data.markerId ?? null },
      editionId
    )

    const reservation = await prisma.stockReservation.create({
      data: {
        stockItemId: itemId,
        userId: user.id,
        startsAt,
        endsAt,
        usage: data.usage,
        quantityReserved: data.quantityReserved,
        location: data.location?.trim() || null,
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
      },
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

    return createSuccessResponse({ reservation })
  },
  { operationName: 'CreateStockReservation' }
)
