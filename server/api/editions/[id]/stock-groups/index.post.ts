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
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * POST /api/editions/[id]/stock-groups
 *
 * Crée un nouveau groupe de stock. Réservé aux utilisateurs avec
 * `canManageStock` (les team leaders ne peuvent que consulter / réserver).
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageStock(edition, user)) {
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

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const last = await prisma.stockGroup.findFirst({
        where: { editionId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    const group = await prisma.stockGroup.create({
      data: {
        editionId,
        name: data.name,
        description: data.description?.trim() || null,
        displayOrder,
      },
    })

    return createSuccessResponse({ group })
  },
  { operationName: 'CreateStockGroup' }
)
