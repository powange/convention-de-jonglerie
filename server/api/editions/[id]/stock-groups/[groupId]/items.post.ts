import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis').max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    // location, zoneId et markerId : au moins un des trois doit être renseigné
    location: z.string().trim().max(200).nullable().optional(),
    zoneId: z.number().int().positive().nullable().optional(),
    markerId: z.number().int().positive().nullable().optional(),
    quantity: z.number().int().positive().default(1),
    notes: z.string().trim().max(2000).nullable().optional(),
    displayOrder: z.number().int().optional(),
  })
  .refine((data) => !!(data.location?.trim() || data.zoneId || data.markerId), {
    message: 'Indiquez une localisation textuelle ou un emplacement sur la carte',
    path: ['location'],
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

    // Vérifier que zone / marker appartiennent à l'édition si fournis
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

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const last = await prisma.stockItem.findFirst({
        where: { stockGroupId: groupId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    const item = await prisma.stockItem.create({
      data: {
        stockGroupId: groupId,
        name: data.name,
        description: data.description?.trim() || null,
        location: data.location?.trim() || '',
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
        quantity: data.quantity,
        notes: data.notes?.trim() || null,
        displayOrder,
      },
      include: {
        zone: { select: { id: true, name: true, color: true } },
        marker: { select: { id: true, name: true } },
      },
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'CreateStockItem' }
)
