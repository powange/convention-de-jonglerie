import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { assertResponsablesDeLEdition } from '#server/utils/personnes-edition'
import { MESSAGE_QUANTITE_MAX, QUANTITE_MAX_STOCK } from '#server/utils/quantite-stock'
import { stockItemLocationInclude, validateReservationLocation } from '#server/utils/stock-helpers'
import { assertTagsBelongToEdition } from '#server/utils/stock-tags-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().int().positive().max(QUANTITE_MAX_STOCK, MESSAGE_QUANTITE_MAX).default(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
  // Emplacement de rangement par défaut (tous les champs sont optionnels :
  // un item peut ne pas avoir d'emplacement renseigné).
  location: z.string().trim().max(200).nullable().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  markerId: z.number().int().positive().nullable().optional(),
  // Emprunt externe (optionnel)
  isExternalLoan: z.boolean().optional(),
  ownerContact: z.string().trim().max(500).nullable().optional(),
  returnDueAt: z.string().datetime().nullable().optional(),
  pickupLocation: z.string().trim().max(500).nullable().optional(),
  pickupResponsibleId: z.number().int().positive().nullable().optional(),
  pickupContact: z.string().trim().max(500).nullable().optional(),
  returnLocation: z.string().trim().max(500).nullable().optional(),
  returnResponsibleId: z.number().int().positive().nullable().optional(),
  returnContact: z.string().trim().max(500).nullable().optional(),
  // Zéro accepté, contrairement à `quantity` : tout perdre est un constat possible.
  finalQuantity: z
    .number()
    .int()
    .min(0)
    .max(QUANTITE_MAX_STOCK, MESSAGE_QUANTITE_MAX)
    .nullable()
    .optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
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

    if (data.zoneId && data.markerId) {
      throw createError({
        status: 400,
        message: 'Un emplacement ne peut pas être à la fois une zone et un marqueur',
      })
    }
    await validateReservationLocation(
      { zoneId: data.zoneId ?? null, markerId: data.markerId ?? null },
      editionId
    )

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
    // Les tags doivent être ceux de cette édition : un identifiant emprunté ailleurs passerait
    // sinon la permission d'ici.
    const tagIds = Array.from(new Set(data.tagIds ?? []))
    // Un responsable désigné doit être de l'édition : c'était la seule référence du module
    // qui n'était pas confrontée à elle. Voir `personnes-edition`.
    await assertResponsablesDeLEdition(editionId, edition.conventionId, [
      data.pickupResponsibleId,
      data.returnResponsibleId,
    ])

    await assertTagsBelongToEdition(editionId, tagIds)

    const isExternalLoan = data.isExternalLoan === true
    const item = await prisma.stockItem.create({
      data: {
        stockGroupId: groupId,
        name: data.name,
        description: data.description?.trim() || null,
        quantity: data.quantity,
        notes: data.notes?.trim() || null,
        displayOrder,
        location: data.location?.trim() || null,
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
        isExternalLoan,
        ownerContact: isExternalLoan ? data.ownerContact?.trim() || null : null,
        returnDueAt: isExternalLoan && data.returnDueAt ? new Date(data.returnDueAt) : null,
        returnedAt: isExternalLoan && data.returnedAt ? new Date(data.returnedAt) : null,
        // La logistique n'a de sens que pour un emprunt : sans la case, rien n'est retenu.
        pickupLocation: isExternalLoan ? data.pickupLocation?.trim() || null : null,
        pickupResponsibleId: isExternalLoan ? (data.pickupResponsibleId ?? null) : null,
        pickupContact: isExternalLoan ? data.pickupContact?.trim() || null : null,
        returnLocation: isExternalLoan ? data.returnLocation?.trim() || null : null,
        returnResponsibleId: isExternalLoan ? (data.returnResponsibleId ?? null) : null,
        returnContact: isExternalLoan ? data.returnContact?.trim() || null : null,
        // Le comptage de fin vaut pour tout le matériel, emprunté ou non.
        finalQuantity: data.finalQuantity ?? null,
        ...(tagIds.length > 0 ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      },
      include: stockItemLocationInclude,
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'CreateStockItem' }
)
