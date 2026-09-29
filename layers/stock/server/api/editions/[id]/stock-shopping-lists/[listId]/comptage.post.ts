import {
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
} from '../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * POST /api/editions/[id]/stock-shopping-lists/[listId]/comptage
 *
 * « Tout a été acheté » : pour chaque article COCHÉ de la liste, le comptage de l'objet rejoint la
 * quantité attendue. Ces objets cessent alors d'apparaître comme manquants.
 *
 * Le geste qu'on fait en rentrant des courses. Sans lui, il fallait rouvrir chaque objet un par un
 * et retaper un nombre qu'on connaissait déjà — sur une liste de vingt lignes, personne ne le
 * faisait, et l'écran des manquants restait faux.
 *
 * ⚠️ **C'est une affirmation, pas une déduction.** `finalQuantity` à `null` signifie « pas encore
 * compté », ce qui n'est pas la même chose que zéro ; le porter à `quantity` transforme « on ne
 * sait pas » en « on a le compte complet ». C'est bien ce qu'on demande au bouton — mais celui qui
 * le presse répond de ce qu'il déclare, et c'est pourquoi l'écran le lui fait confirmer.
 *
 * Le serveur relit les articles cochés plutôt que de croire la liste que le client lui enverrait :
 * deux personnes font les courses ensemble, et celle qui appuie n'a pas forcément à l'écran les
 * cases que l'autre vient de cocher.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)
    const listId = idDeRoute(event, 'listId', 'de liste')

    await exigerListeDeLEdition(listId, editionId)

    const articles = await prisma.stockShoppingListItem.findMany({
      where: { listId, purchased: true },
      select: { item: { select: { id: true, quantity: true } } },
    })

    if (articles.length === 0) {
      return createSuccessResponse({ updated: 0 })
    }

    /*
     * Une écriture par objet, dans une transaction.
     *
     * `updateMany` ne saurait pas faire : chaque objet reçoit SA quantité attendue, qui diffère
     * d'une ligne à l'autre. La transaction évite qu'un incident laisse la moitié de la liste
     * comptée et l'autre pas — état qu'aucun écran ne montrerait comme anormal.
     */
    await prisma.$transaction(
      articles.map(({ item }) =>
        prisma.stockItem.update({
          where: { id: item.id },
          data: { finalQuantity: item.quantity },
        })
      )
    )

    return createSuccessResponse({ updated: articles.length })
  },
  { operationName: 'CompterListeDeCoursesAchetee' }
)
