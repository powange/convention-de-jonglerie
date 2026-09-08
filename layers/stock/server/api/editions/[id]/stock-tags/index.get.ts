import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-tags
 *
 * Les tags de l'édition, dans leur ordre d'affichage. Accessible à qui peut consulter le stock :
 * les pastilles accompagnent le matériel, elles ne sont pas plus confidentielles que lui.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const tags = await prisma.stockTag.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, displayOrder: true },
    })

    return createSuccessResponse({ tags })
  },
  { operationName: 'ListStockTags' }
)
