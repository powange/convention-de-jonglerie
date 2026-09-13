import { z } from 'zod'

import {
  exigerArticleDeLaListe,
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
} from '../../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  purchased: z.boolean(),
})

/**
 * PATCH /api/editions/[id]/stock-shopping-lists/[listId]/items/[articleId]
 *
 * Coche ou décoche un article.
 *
 * Le geste le plus fréquent du module, et le seul qu'on fait debout dans un rayon : il ne touche
 * qu'une ligne, et n'entraîne rien d'autre. Pas de « liste terminée » à écrire quelque part —
 * l'état de la liste se lit de ses articles (`listeTerminee`), et le stocker en double ouvrirait
 * la porte à ce qu'il contredise ce qu'on voit.
 *
 * `purchased` est exigé plutôt que basculé côté serveur : deux personnes qui cochent la même ligne
 * au même moment doivent aboutir au même état, pas à deux bascules qui s'annulent.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)
    const listId = idDeRoute(event, 'listId', 'de liste')
    const articleId = idDeRoute(event, 'articleId', "d'article")

    await exigerListeDeLEdition(listId, editionId)
    await exigerArticleDeLaListe(articleId, listId)

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const item = await prisma.stockShoppingListItem.update({
      where: { id: articleId },
      data: { purchased: data.purchased },
      select: { id: true, purchased: true },
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'UpdateStockShoppingListItem' }
)
