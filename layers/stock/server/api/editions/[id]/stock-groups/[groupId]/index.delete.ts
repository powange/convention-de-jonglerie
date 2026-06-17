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

    const existing = await prisma.stockGroup.findFirst({
      where: { id: groupId, editionId },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    // Cascade : items et reservations supprimés via onDelete: Cascade
    await prisma.stockGroup.delete({ where: { id: groupId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteStockGroup' }
)
