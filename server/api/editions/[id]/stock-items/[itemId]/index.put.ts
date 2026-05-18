import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().min(1).max(200).optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  markerId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
  stockGroupId: z.number().int().positive().optional(),
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
    // Vérifier zone / marker si modifiés
    if (data.zoneId) {
      const zone = await prisma.editionZone.findFirst({
        where: { id: data.zoneId, editionId },
        select: { id: true },
      })
      if (!zone) {
        throw createError({ status: 400, message: "La zone n'appartient pas à cette édition" })
      }
    }
    if (data.markerId) {
      const marker = await prisma.editionMarker.findFirst({
        where: { id: data.markerId, editionId },
        select: { id: true },
      })
      if (!marker) {
        throw createError({
          status: 400,
          message: "Le marqueur n'appartient pas à cette édition",
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.location !== undefined) updateData.location = data.location
    if (data.zoneId !== undefined) updateData.zoneId = data.zoneId
    if (data.markerId !== undefined) updateData.markerId = data.markerId
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder
    if (data.stockGroupId !== undefined) updateData.stockGroupId = data.stockGroupId

    const item = await prisma.stockItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        zone: { select: { id: true, name: true, color: true } },
        marker: { select: { id: true, name: true } },
      },
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'UpdateStockItem' }
)
