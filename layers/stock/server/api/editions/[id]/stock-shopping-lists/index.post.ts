import { z } from 'zod'

import {
  exigerGestionDesListes,
  objetsDeLEdition,
  selectionDeListe,
} from '../../../../utils/listes-de-courses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  /**
   * Le matériel à mettre dedans dès la création.
   *
   * Optionnel : on crée souvent la liste depuis la page des manquants, cases déjà cochées, mais
   * rien n'interdit de partir d'une liste vide et de la remplir ensuite.
   */
  itemIds: z.array(z.number().int().positive()).max(500).optional(),
})

/**
 * POST /api/editions/[id]/stock-shopping-lists
 *
 * Crée une liste de courses, éventuellement déjà remplie.
 *
 * Les noms ne sont PAS uniques, contrairement aux tags. Deux « Quincaillerie » à trois semaines
 * d'intervalle sont deux courses différentes, et refuser la seconde obligerait à inventer un nom
 * qui ne dit rien de plus. La date de création les distingue à l'écran.
 *
 * Le matériel reçu est filtré sur l'édition avant d'être écrit : voir `objetsDeLEdition`. Un
 * identifiant étranger est ignoré silencieusement plutôt que de faire échouer la création — c'est
 * une requête forgée, pas une faute de l'utilisateur, et rien de ce qu'il a demandé n'est perdu.
 */
export default wrapApiHandler(
  async (event) => {
    const { editionId } = await exigerGestionDesListes(event)

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const idsValides = await objetsDeLEdition(data.itemIds ?? [], editionId)

    const list = await prisma.stockShoppingList.create({
      data: {
        editionId,
        name: data.name,
        items: { create: idsValides.map((stockItemId) => ({ stockItemId })) },
      },
      select: selectionDeListe,
    })

    return createSuccessResponse({ list })
  },
  { operationName: 'CreateStockShoppingList' }
)
