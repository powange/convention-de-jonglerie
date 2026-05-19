import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import {
  mergeStockItemLocations,
  stockItemLocationInputSchema,
  stockItemLocationsInclude,
  validateStockItemLocations,
} from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
  locations: z.array(stockItemLocationInputSchema).max(50).optional(),
  // Emprunt externe (optionnel)
  isExternalLoan: z.boolean().optional(),
  ownerContact: z.string().trim().max(500).nullable().optional(),
  returnDueAt: z.string().datetime().nullable().optional(),
  returnedAt: z.string().datetime().nullable().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const group = await prisma.stockGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Fusionner les emplacements ciblant le même endroit (mêmes zone/marker/texte)
    const { merged: locations, mergedCount } = mergeStockItemLocations(data.locations ?? [])
    await validateStockItemLocations(locations, editionId, data.quantity)

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const last = await prisma.stockItem.findFirst({
        where: { stockGroupId: groupId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    // Emprunt externe : si le flag est false, on ignore les autres champs
    const isExternalLoan = data.isExternalLoan === true
    const item = await prisma.stockItem.create({
      data: {
        stockGroupId: groupId,
        name: data.name,
        description: data.description?.trim() || null,
        quantity: data.quantity,
        notes: data.notes?.trim() || null,
        displayOrder,
        isExternalLoan,
        ownerContact: isExternalLoan ? data.ownerContact?.trim() || null : null,
        returnDueAt: isExternalLoan && data.returnDueAt ? new Date(data.returnDueAt) : null,
        returnedAt: isExternalLoan && data.returnedAt ? new Date(data.returnedAt) : null,
        locations: {
          create: locations.map((loc, idx) => ({
            location: loc.location?.trim() || null,
            zoneId: loc.zoneId ?? null,
            markerId: loc.markerId ?? null,
            quantity: loc.quantity,
            displayOrder: idx,
          })),
        },
      },
      include: {
        locations: stockItemLocationsInclude,
      },
    })

    return createSuccessResponse({ item, mergedLocations: mergedCount })
  },
  { operationName: 'CreateStockItem' }
)
