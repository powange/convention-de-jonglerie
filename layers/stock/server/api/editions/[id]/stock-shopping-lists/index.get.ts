import { selectionDeListe } from '../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-shopping-lists
 *
 * Les listes de courses de l'édition, avec leur contenu.
 *
 * En lecture seule, le droit de consultation suffit — celui qui va faire les courses n'est pas
 * toujours celui qui tient l'inventaire. Les écrire, en revanche, demande le droit de gestion.
 *
 * La plus récente d'abord : on crée une liste pour s'en servir tout de suite, et les anciennes
 * descendent d'elles-mêmes à mesure qu'elles perdent leur utilité.
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

    const lists = await prisma.stockShoppingList.findMany({
      where: { editionId },
      select: selectionDeListe,
      orderBy: { createdAt: 'desc' },
    })

    return createSuccessResponse({ lists })
  },
  { operationName: 'GetStockShoppingLists' }
)
