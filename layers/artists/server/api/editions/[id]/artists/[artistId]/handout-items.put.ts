import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import {
  handoutItemSelectionSchema,
  normalizeHandoutItemSelections,
} from '#server/utils/ticketing/handout-item-selection'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  handoutItemIds: z.array(handoutItemSelectionSchema),
})

/**
 * PUT /api/editions/[id]/artists/[artistId]/handout-items
 *
 * Met à jour les articles à remettre à un artiste précis, avec le nombre d'exemplaires de
 * chacun. Remplace l'ensemble des associations existantes de cet artiste.
 *
 * Ces articles s'ajoutent à ceux remis à tous les artistes de l'édition et à ceux attachés
 * aux spectacles de l'artiste : ils ne les remplacent pas.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

    const allowed = await canManageArtistsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    // L'artiste doit appartenir à cette édition : sans ce contrôle, un identifiant d'artiste
    // d'une autre édition passerait la permission de celle-ci.
    const artist = await prisma.editionArtist.findFirst({
      where: { id: artistId, editionId },
      select: { id: true },
    })
    if (!artist) {
      throw createError({ status: 404, message: 'Artiste introuvable' })
    }

    const body = bodySchema.parse(await readBody(event))
    const selections = normalizeHandoutItemSelections(body.handoutItemIds)
    const handoutItemIds = selections.map((s) => s.handoutItemId)

    // Vérifier que tous les articles appartiennent à l'édition.
    if (handoutItemIds.length > 0) {
      const count = await prisma.ticketingHandoutItem.count({
        where: { id: { in: handoutItemIds }, editionId },
      })
      if (count !== handoutItemIds.length) {
        throw createError({
          status: 400,
          message: "Certains articles n'appartiennent pas à cette édition",
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.artistHandoutItem.deleteMany({ where: { artistId } })
      if (selections.length > 0) {
        await tx.artistHandoutItem.createMany({
          data: selections.map(({ handoutItemId, quantity }) => ({
            artistId,
            handoutItemId,
            quantity,
          })),
        })
      }
    })

    return createSuccessResponse({ artistId, handoutItems: selections })
  },
  { operationName: 'PUT artist handout-items' }
)
