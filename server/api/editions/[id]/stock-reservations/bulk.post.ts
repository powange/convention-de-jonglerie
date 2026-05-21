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
    items: z
      .array(
        z.object({
          id: z.number().int().positive(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1)
      .max(50),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    usage: z.string().trim().min(1, "L'utilisation est requise").max(500),
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
 * POST /api/editions/[id]/stock-reservations/bulk
 *
 * Crée en une seule transaction des réservations pour plusieurs items
 * avec la même période, le même emplacement et le même usage.
 * Quantité fixée à 1 par item.
 *
 * Toutes les vérifications de disponibilité sont effectuées avant écriture :
 * si UN SEUL item n'est pas disponible, la requête est rejetée intégralement
 * avec la liste des items en conflit.
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

    // Fusionner les doublons (même id présent plusieurs fois → on additionne).
    const requestedByItem = new Map<number, number>()
    for (const entry of data.items) {
      requestedByItem.set(entry.id, (requestedByItem.get(entry.id) ?? 0) + entry.quantity)
    }

    // Validation du lieu d'abord (peu coûteux, échec rapide).
    await validateReservationLocation(
      { zoneId: data.zoneId ?? null, markerId: data.markerId ?? null },
      editionId
    )

    // Toute la séquence vérif-dispo + création dans une transaction pour
    // serrer la fenêtre de race condition entre vérification et écriture.
    const result = await prisma.$transaction(async (tx) => {
      const itemIds = Array.from(requestedByItem.keys())
      const items = await tx.stockItem.findMany({
        where: { id: { in: itemIds }, group: { editionId } },
        select: { id: true, name: true, quantity: true },
        orderBy: { id: 'asc' },
      })
      if (items.length !== itemIds.length) {
        throw createError({
          status: 400,
          message: "Certains objets n'existent pas ou n'appartiennent pas à cette édition",
        })
      }

      // Vérifier la dispo de chaque item dans la transaction. On retourne
      // depuis le map puis on filtre, pour garantir un ordre stable.
      const unavailable = (
        await Promise.all(
          items.map(async (item) => {
            const requested = requestedByItem.get(item.id)!
            if (requested > item.quantity) {
              return {
                id: item.id,
                name: item.name,
                requested,
                available: item.quantity,
              }
            }
            const alreadyReserved = await getReservedQuantityOnPeriod(
              item.id,
              startsAt,
              endsAt,
              undefined,
              tx
            )
            const available = item.quantity - alreadyReserved
            if (requested > available) {
              return { id: item.id, name: item.name, requested, available }
            }
            return null
          })
        )
      ).filter((u): u is NonNullable<typeof u> => u !== null)

      if (unavailable.length > 0) {
        throw createError({
          status: 409,
          message: 'Certains objets ne sont pas disponibles dans la quantité demandée',
          data: { unavailable },
        })
      }

      const created = await Promise.all(
        items.map((item) =>
          tx.stockReservation.create({
            data: {
              stockItemId: item.id,
              userId: user.id,
              startsAt,
              endsAt,
              usage: data.usage,
              quantityReserved: requestedByItem.get(item.id)!,
              location: data.location?.trim() || null,
              zoneId: data.zoneId ?? null,
              markerId: data.markerId ?? null,
            },
            select: { id: true },
          })
        )
      )
      return created
    })

    return createSuccessResponse({ created: result.length, ids: result.map((r) => r.id) })
  },
  { operationName: 'CreateBulkStockReservations' }
)
