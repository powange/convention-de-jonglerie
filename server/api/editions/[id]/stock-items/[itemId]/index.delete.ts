import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

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

    // Cascade : reservations supprimées via onDelete: Cascade
    await prisma.stockItem.delete({ where: { id: itemId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteStockItem' }
)
