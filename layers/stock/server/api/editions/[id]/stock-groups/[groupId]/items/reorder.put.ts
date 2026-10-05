import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const reorderSchema = z.object({
  /** Les objets du groupe, dans l'ordre voulu. */
  itemIds: z.array(z.number().int().positive()).min(1),
})

/**
 * PUT /api/editions/[id]/stock-groups/[groupId]/items/reorder
 *
 * L'ordre des objets d'un groupe, tel qu'on veut les lire — pas celui d'une colonne.
 *
 * ⚠️ POURQUOI CE POINT D'API MANQUAIT, ET CE QUI EXISTAIT DÉJÀ. `StockItem.displayOrder` est en
 * base depuis l'origine, avec son index `[stockGroupId, displayOrder]`, la création attribue
 * `dernier + 1`, et la lecture trie dessus. Tout était là SAUF le moyen de le changer : l'ordre
 * valait donc l'ordre d'ajout, définitivement.
 *
 * 📍 LA LISTE DOIT ÊTRE COMPLÈTE, et c'est la garde qui compte. On n'accepte le réordonnancement
 * que si les identifiants reçus sont exactement ceux du groupe : une liste partielle laisserait
 * les absents sur leur ancien rang, mêlés aux nouveaux — un ordre que personne n'a demandé et que
 * rien ne signalerait. C'est plus strict que le réordonnancement des marqueurs de la carte, qui se
 * contente de vérifier l'appartenance.
 */
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

    const { itemIds } = reorderSchema.parse(await readBody(event))

    // Le groupe doit être celui de cette édition : sans quoi on réordonnerait le stock d'une
    // autre convention avec le droit de gérer la sienne.
    const group = await prisma.stockGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const objets = await prisma.stockItem.findMany({
      where: { stockGroupId: groupId },
      select: { id: true },
    })

    const attendus = new Set(objets.map((o) => o.id))
    const recus = new Set(itemIds)
    const listeComplete =
      recus.size === itemIds.length &&
      attendus.size === recus.size &&
      itemIds.every((id) => attendus.has(id))

    if (!listeComplete) {
      throw createError({
        status: 400,
        message: 'La liste doit contenir exactement les objets de ce groupe, chacun une seule fois',
      })
    }

    await prisma.$transaction(
      itemIds.map((itemId, rang) =>
        prisma.stockItem.update({ where: { id: itemId }, data: { displayOrder: rang } })
      )
    )

    return createSuccessResponse({ count: itemIds.length }, 'Ordre enregistré')
  },
  { operationName: 'PUT stock group items reorder' }
)
