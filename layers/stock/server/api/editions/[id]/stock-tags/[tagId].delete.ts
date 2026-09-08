import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/stock-tags/[tagId]
 *
 * Supprime un tag. Les rattachements partent avec lui — c'est la cascade du schéma —, le matériel
 * lui-même n'est pas touché.
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

    await prisma.stockTag.delete({ where: { id: tagId } })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteStockTag' }
)
