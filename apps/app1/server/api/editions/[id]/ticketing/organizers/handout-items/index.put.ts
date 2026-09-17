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
  /** NULL ou absent = portée globale (tous les organisateurs) ; défini = un organisateur précis. */
  organizerId: z.number().int().positive().nullable().optional(),
  handoutItemIds: z.array(handoutItemSelectionSchema),
})

/**
 * PUT /api/editions/[id]/ticketing/organizers/handout-items
 *
 * Remplace l'ensemble des articles à remettre d'UNE portée — un organisateur, ou tous les
 * organisateurs. Voir le point d'API jumeau des bénévoles pour le raisonnement complet : une
 * quantité devenait immodifiable, et la vérification-puis-création laissait une course ouverte
 * sur la ligne globale, que l'index unique ne protège pas sous MySQL.
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
    const organizerId = body.organizerId ?? null

    if (organizerId) {
      const organizer = await prisma.editionOrganizer.findFirst({
        where: { id: organizerId, editionId },
        select: { id: true },
      })
      if (!organizer) {
        throw createError({ status: 404, message: 'Organisateur introuvable' })
      }
    }

    const selections = normalizeHandoutItemSelections(body.handoutItemIds)
    await exigerDesArticlesDeLEdition(
      editionId,
      selections.map((s) => s.handoutItemId)
    )

    await prisma.$transaction(async (tx) => {
      await tx.editionOrganizerHandoutItem.deleteMany({ where: { editionId, organizerId } })
      if (selections.length > 0) {
        await tx.editionOrganizerHandoutItem.createMany({
          data: selections.map(({ handoutItemId, quantity }) => ({
            editionId,
            organizerId,
            handoutItemId,
            quantity,
          })),
        })
      }
    })

    return createSuccessResponse({ organizerId, handoutItems: selections })
  },
  { operationName: 'PUT ticketing organizers handout-items' }
)
