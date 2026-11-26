import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import {
  handoutItemSelectionSchema,
  normalizeHandoutItemSelections,
} from '#server/utils/ticketing/handout-item-selection'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'
import { exigerDesArticlesDeLEdition } from '#server/utils/ticketing/handout-items-portee'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  handoutItemIds: z.array(handoutItemSelectionSchema),
})

/**
 * PUT /api/editions/[id]/ticketing/artists/handout-items
 *
 * Remplace l'ensemble des articles à remettre à TOUS les artistes de l'édition. Les articles
 * propres à un spectacle ou à un artiste précis sont gérés par leurs propres points d'API.
 *
 * Il n'y a ici qu'une seule portée — `EditionArtistHandoutItem` ne porte pas de colonne nullable,
 * et son index unique `(editionId, handoutItemId)` protège donc réellement. La course qui
 * menaçait les deux autres populations n'existait pas ici ; le remplacement complet est repris
 * pour la seule raison qui vaut partout : la quantité redevient modifiable, et les trois écrans
 * se règlent de la même façon.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })
    }

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    await exigerArticlesARemettreActifs(editionId)

    const body = bodySchema.parse(await readBody(event))
    const selections = normalizeHandoutItemSelections(body.handoutItemIds)
    await exigerDesArticlesDeLEdition(
      editionId,
      selections.map((s) => s.handoutItemId)
    )

    await prisma.$transaction(async (tx) => {
      await tx.editionArtistHandoutItem.deleteMany({ where: { editionId } })
      if (selections.length > 0) {
        await tx.editionArtistHandoutItem.createMany({
          data: selections.map(({ handoutItemId, quantity }) => ({
            editionId,
            handoutItemId,
            quantity,
          })),
        })
      }
    })

    return createSuccessResponse({ handoutItems: selections })
  },
  { operationName: 'PUT ticketing artists handout-items' }
)
