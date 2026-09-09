import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { STOCK_TAG_COLOR_PATTERN } from '#server/utils/stock-tags-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  color: z
    .string()
    .regex(STOCK_TAG_COLOR_PATTERN, 'La couleur doit être au format hexadécimal #RRGGBB'),
  displayOrder: z.number().int().optional(),
})

/**
 * POST /api/editions/[id]/stock-tags
 *
 * Crée un tag sur l'édition. Le couple (édition, nom) est unique : deux « fragile » dans la même
 * édition ne se distingueraient pas à l'œil, et le second est donc refusé en 409.
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
      const max = await prisma.stockTag.aggregate({
        where: { editionId },
        _max: { displayOrder: true },
      })
      displayOrder = (max._max.displayOrder ?? -1) + 1
    }

    try {
      const tag = await prisma.stockTag.create({
        data: { editionId, name: data.name, color: data.color, displayOrder },
        select: { id: true, name: true, color: true, displayOrder: true },
      })
      return createSuccessResponse({ tag })
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw createError({ status: 409, message: 'Un tag avec ce nom existe déjà' })
      }
      throw e
    }
  },
  { operationName: 'CreateStockTag' }
)
