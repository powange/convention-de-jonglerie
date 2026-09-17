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
  /** NULL ou absent = portée globale (tous les bénévoles) ; défini = une équipe précise. */
  teamId: z.string().nullable().optional(),
  handoutItemIds: z.array(handoutItemSelectionSchema),
})

/**
 * PUT /api/editions/[id]/ticketing/volunteers/handout-items
 *
 * Remplace l'ensemble des articles à remettre d'UNE portée — les bénévoles d'une équipe, ou
 * tous les bénévoles. Les autres portées ne sont pas touchées.
 *
 * Ce point d'API remplace le couple POST + DELETE par association, pour deux raisons.
 *
 * La première est qu'une quantité posée ne se modifiait plus : il fallait supprimer
 * l'association et la recréer, la liste n'offrant qu'un bouton « Supprimer ». C'est la
 * correction la plus banale qui soit sur ce genre de réglage, et c'était celle qui coûtait le
 * plus de gestes.
 *
 * La seconde est qu'une écriture qui lit puis crée porte une course : l'index unique
 * `(editionId, handoutItemId, teamId)` NE PROTÈGE PAS la portée globale, MySQL considérant deux
 * NULL comme distincts. Le POST s'en défendait par un `SELECT … FOR UPDATE`, ce qui refermait la
 * fenêtre sans supprimer la lecture qui l'ouvrait. Remplacer une portée entière n'a plus rien à
 * vérifier : on efface, on réécrit, et le doublon global n'a pas d'endroit où naître.
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
    const teamId = body.teamId ?? null

    if (teamId) {
      const team = await prisma.volunteerTeam.findFirst({
        where: { id: teamId, eventId: editionId },
        select: { id: true },
      })
      if (!team) {
        throw createError({ status: 404, message: 'Équipe introuvable' })
      }
    }

    const selections = normalizeHandoutItemSelections(body.handoutItemIds)
    await exigerDesArticlesDeLEdition(
      editionId,
      selections.map((s) => s.handoutItemId)
    )

    await prisma.$transaction(async (tx) => {
      await tx.editionVolunteerHandoutItem.deleteMany({ where: { editionId, teamId } })
      if (selections.length > 0) {
        await tx.editionVolunteerHandoutItem.createMany({
          data: selections.map(({ handoutItemId, quantity }) => ({
            editionId,
            teamId,
            handoutItemId,
            quantity,
          })),
        })
      }
    })

    return createSuccessResponse({ teamId, handoutItems: selections })
  },
  { operationName: 'PUT ticketing volunteers handout-items' }
)
