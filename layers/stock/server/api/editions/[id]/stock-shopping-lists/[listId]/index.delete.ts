import {
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
} from '../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * DELETE /api/editions/[id]/stock-shopping-lists/[listId]
 *
 * Supprime une liste et ses articles, sans condition.
 *
 * Aucun garde-fou ici, contrairement à la fermeture des réservations d'un groupe : une liste de
 * courses ne promet rien à personne d'autre qu'à celui qui la tient. Supprimer ne fait perdre que
 * la liste, jamais du matériel ni un comptage — ceux-ci vivent sur les objets, que la cascade ne
 * touche pas. C'est bien le lien qui disparaît, pas ce qu'il désigne.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)
    const listId = idDeRoute(event, 'listId', 'de liste')

    await exigerListeDeLEdition(listId, editionId)

    await prisma.stockShoppingList.delete({ where: { id: listId } })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteStockShoppingList' }
)
