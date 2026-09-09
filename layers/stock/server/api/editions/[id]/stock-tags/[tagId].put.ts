import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { STOCK_TAG_COLOR_PATTERN } from '#server/utils/stock-tags-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(50).optional(),
  color: z
    .string()
    .regex(STOCK_TAG_COLOR_PATTERN, 'La couleur doit être au format hexadécimal #RRGGBB')
    .optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * PUT /api/editions/[id]/stock-tags/[tagId]
 *
 * Renomme, recolore ou réordonne un tag. Le tag doit appartenir à l'édition : sans ce contrôle,
 * un identifiant emprunté ailleurs se modifierait avec la permission d'ici.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const tagId = validateResourceId(event, 'tagId', 'tag')

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.stockTag.findFirst({
      where: { id: tagId, editionId },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Tag introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    try {
      const tag = await prisma.stockTag.update({
        where: { id: tagId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
        },
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
  { operationName: 'UpdateStockTag' }
)
