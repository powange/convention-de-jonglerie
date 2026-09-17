import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import {
  handoutItemSelectionSchema,
  normalizeHandoutItemSelections,
} from '#server/utils/ticketing/handout-item-selection'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'
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

    /*
     * Droit BILLETTERIE, et non « artistes », bien que la route vive dans ce layer.
     *
     * Ce point d'API exigeait `canManageArtistsById` — le seul des huit points d'API dédiés aux
     * articles à remettre à ne pas demander le droit billetterie. Ce n'était pas seulement une
     * incohérence : la seule surface qui l'appelle est la page billetterie des articles à
     * remettre, elle-même gardée par `canManageTicketing`. Les deux droits étant des colonnes
     * indépendantes, un organisateur qui gère la billetterie sans gérer les artistes voyait donc
     * le bouton et recevait un 403 en enregistrant.
     *
     * La règle retenue : « ce qu'on remet » est une compétence billetterie, sans exception.
     *
     * Elle ne vaut que pour les points d'API DÉDIÉS aux articles. `shows/[showId].put` et
     * `volunteers/meals.put` gardent leur propre droit : les articles n'y sont qu'un champ parmi
     * douze d'une mise à jour complète, et y exiger la billetterie casserait l'édition d'un
     * spectacle ou d'un repas.
     */
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    //
    // Cet appel vivait À L'INTÉRIEUR du `if (!allowed)`, après le `throw` : il n'était donc
    // jamais atteint, et l'interrupteur ne coupait pas ces quatre écritures.
    await exigerArticlesARemettreActifs(editionId)

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
