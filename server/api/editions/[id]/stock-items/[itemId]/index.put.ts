import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import {
  stockItemLocationInputSchema,
  stockItemLocationsInclude,
  validateStockItemLocations,
} from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
  stockGroupId: z.number().int().positive().optional(),
  // Si fourni, remplace l'intégralité des sous-emplacements de l'item.
  locations: z.array(stockItemLocationInputSchema).max(50).optional(),
})

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
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.stockItem.findFirst({
      where: { id: itemId, group: { editionId } },
    })
    if (!existing) {
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

    // Si on change de groupe, vérifier qu'il appartient à la même édition
    if (data.stockGroupId !== undefined && data.stockGroupId !== existing.stockGroupId) {
      const targetGroup = await prisma.stockGroup.findFirst({
        where: { id: data.stockGroupId, editionId },
        select: { id: true },
      })
      if (!targetGroup) {
        throw createError({
          status: 400,
          message: "Le groupe cible n'appartient pas à cette édition",
        })
      }
    }

    // Validation des sous-emplacements si fournis. La somme est validée contre
    // la nouvelle quantity si elle change, sinon contre celle existante.
    if (data.locations !== undefined) {
      const targetQuantity = data.quantity ?? existing.quantity
      await validateStockItemLocations(data.locations, editionId, targetQuantity)
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder
    if (data.stockGroupId !== undefined) updateData.stockGroupId = data.stockGroupId

    // Si la quantité diminue sans nouvelles locations envoyées, on doit
    // s'assurer que la somme des locations existantes reste ≤ nouvelle quantity.
    if (data.quantity !== undefined && data.locations === undefined) {
      const existingLocations = await prisma.stockItemLocation.findMany({
        where: { stockItemId: itemId },
        select: { quantity: true },
      })
      const totalLocated = existingLocations.reduce((sum, l) => sum + l.quantity, 0)
      if (totalLocated > data.quantity) {
        throw createError({
          status: 400,
          message:
            'La nouvelle quantité est inférieure à la somme des quantités déjà réparties par emplacement',
        })
      }
    }

    // Si la quantité diminue, vérifier qu'aucune réservation active/future ne
    // dépasse la nouvelle quantité sur sa période. Sinon des réservations
    // existantes deviendraient « impossibles » silencieusement.
    if (data.quantity !== undefined && data.quantity < existing.quantity) {
      const futureReservations = await prisma.stockReservation.findMany({
        where: {
          stockItemId: itemId,
          status: { in: ['RESERVED', 'PICKED_UP'] },
          endsAt: { gt: new Date() },
        },
        select: { quantityReserved: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: 'asc' },
      })
      // Calcul du pic de réservation simultanée par balayage d'événements
      const events: { date: Date; delta: number }[] = []
      for (const r of futureReservations) {
        events.push({ date: r.startsAt, delta: r.quantityReserved })
        events.push({ date: r.endsAt, delta: -r.quantityReserved })
      }
      events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.delta - b.delta)
      let current = 0
      let peak = 0
      for (const e of events) {
        current += e.delta
        if (current > peak) peak = current
      }
      if (peak > data.quantity) {
        throw createError({
          status: 400,
          message: `La nouvelle quantité (${data.quantity}) est inférieure au pic de réservations simultanées (${peak})`,
        })
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.stockItem.update({ where: { id: itemId }, data: updateData })

      if (data.locations !== undefined) {
        await tx.stockItemLocation.deleteMany({ where: { stockItemId: itemId } })
        if (data.locations.length > 0) {
          await tx.stockItemLocation.createMany({
            data: data.locations.map((loc, idx) => ({
              stockItemId: itemId,
              location: loc.location?.trim() || null,
              zoneId: loc.zoneId ?? null,
              markerId: loc.markerId ?? null,
              quantity: loc.quantity,
              displayOrder: idx,
            })),
          })
        }
      }

      return tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        include: { locations: stockItemLocationsInclude },
      })
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'UpdateStockItem' }
)
