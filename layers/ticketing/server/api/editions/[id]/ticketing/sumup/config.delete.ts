import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTicketing,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/ticketing/sumup/config
 *
 * Supprime la config SumUp d'une édition (utile pour révoquer les credentials).
 * - Accessible uniquement aux organisateurs avec droit de gestion billetterie
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Edition introuvable' })
    }

    if (!canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer la billetterie',
      })
    }

    await prisma.sumupConfig.deleteMany({ where: { editionId } })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteSumupConfig' }
)
