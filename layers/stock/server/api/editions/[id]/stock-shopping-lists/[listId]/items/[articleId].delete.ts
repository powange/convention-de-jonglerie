import {
  exigerArticleDeLaListe,
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
} from '../../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * DELETE /api/editions/[id]/stock-shopping-lists/[listId]/items/[articleId]
 *
 * Retire un article d'une liste.
 *
 * Distinct de le cocher, et les deux gestes doivent rester distincts : cocher dit « acheté »,
 * retirer dit « finalement, on ne le rachète pas ». Les confondre ferait disparaître de la liste
 * ce qu'on vient d'acheter, c'est-à-dire précisément ce qu'on veut pouvoir relire au retour des
 * courses.
 *
 * L'objet du stock, lui, n'est pas touché : seul le lien disparaît.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)
    const listId = idDeRoute(event, 'listId', 'de liste')
    const articleId = idDeRoute(event, 'articleId', "d'article")

    await exigerListeDeLEdition(listId, editionId)
    await exigerArticleDeLaListe(articleId, listId)

    await prisma.stockShoppingListItem.delete({ where: { id: articleId } })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteStockShoppingListItem' }
)
