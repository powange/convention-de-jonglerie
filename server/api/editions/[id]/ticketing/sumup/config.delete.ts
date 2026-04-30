import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketing } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
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

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: {
        id: true,
        convention: {
          include: {
            organizers: { where: { userId: user.id } },
          },
        },
        organizerPermissions: {
          where: { organizer: { userId: user.id } },
          include: { organizer: { select: { userId: true } } },
        },
      },
    })

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
