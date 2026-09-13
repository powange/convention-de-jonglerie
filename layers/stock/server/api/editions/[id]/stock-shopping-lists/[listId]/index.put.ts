import { z } from 'zod'

import {
  exigerGestionDesListes,
  exigerListeDeLEdition,
  idDeRoute,
  selectionDeListe,
} from '../../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
})

/**
 * PUT /api/editions/[id]/stock-shopping-lists/[listId]
 *
 * Renomme une liste. C'est tout ce qu'une liste porte en propre : son contenu se modifie article
 * par article, pour que cocher une case ne réécrive pas la liste entière.
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

    const list = await prisma.stockShoppingList.update({
      where: { id: listId },
      data: { name: data.name },
      select: selectionDeListe,
    })

    return createSuccessResponse({ list })
  },
  { operationName: 'UpdateStockShoppingList' }
)
