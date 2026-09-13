import { z } from 'zod'

import {
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
  objetsDeLEdition,
  selectionDeListe,
} from '../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1, 'Aucun matériel sélectionné').max(500),
})

/**
 * POST /api/editions/[id]/stock-shopping-lists/[listId]/items
 *
 * Ajoute du matériel à une liste existante.
 *
 * `createMany` avec `skipDuplicates` plutôt qu'une boucle : ajouter un objet déjà présent est un
 * geste anodin — on rouvre la page des manquants, on recoche sans se souvenir —, et le contrat
 * d'unicité en ferait autrement une erreur 409 dont l'utilisateur ne saurait que faire. L'écran
 * filtre déjà les doublons de son côté ; ceci couvre le cas où deux personnes ajoutent le même
 * objet en même temps, que l'écran ne peut pas voir.
 *
 * La liste complète est rendue en retour : c'est elle que l'écran réaffiche, et la recalculer
 * côté client à partir de ce qui a été ajouté l'exposerait à diverger de la base.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)
    const listId = idDeRoute(event, 'listId', 'de liste')

    await exigerListeDeLEdition(listId, editionId)

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const idsValides = await objetsDeLEdition(data.itemIds, editionId)

    if (idsValides.length > 0) {
      await prisma.stockShoppingListItem.createMany({
        data: idsValides.map((stockItemId) => ({ listId, stockItemId })),
        skipDuplicates: true,
      })
    }

    const list = await prisma.stockShoppingList.findUnique({
      where: { id: listId },
      select: selectionDeListe,
    })

    return createSuccessResponse({ list, added: idsValides.length })
  },
  { operationName: 'AddStockShoppingListItems' }
)
