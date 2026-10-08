import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

/**
 * Le comptage de clôture : ce qu'on a RELEVÉ dans la caisse, pas ce qu'on en déduit.
 *
 * ⚠️ `min(0)` ET NON `positive()` : une caisse vidée compte zéro, et c'est une information — c'est
 * d'ailleurs le cas où « disponible après restitutions » devient franchement négatif et alerte.
 * Un schéma qui refuserait zéro rendrait ce cas impossible à saisir.
 *
 * `null` efface le comptage, pour revenir à « pas encore compté ». La date suit : la laisser
 * derrière afficherait « compté le 16 juin » sans montant.
 */
const bodySchema = z.object({
  count: z.number().min(0).max(10_000_000).nullable(),
})

/**
 * PUT /api/editions/:id/treasury/cash-float-count — enregistre le comptage de clôture.
 *
 * 📍 Une route SŒUR de `cash-float/`, et non `cash-float/count` : ce second chemin entrerait en
 * concurrence avec `cash-float/[floatId]`, et un identifiant valant « count » est le genre
 * d'ambiguïté qui se règle par chance plutôt que par une règle.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const { count } = bodySchema.parse(await readBody(event))

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const cents = count === null ? null : toCents(count)!
    await prisma.edition.update({
      where: { id: editionId },
      data: {
        cashFloatCount: cents,
        // La date du comptage, pas celle du dernier enregistrement : `updatedAt` bougerait au
        // moindre autre changement de l'édition et donnerait un jour faux et plausible.
        cashFloatCountedAt: cents === null ? null : new Date(),
      },
    })

    return createSuccessResponse({ count: cents })
  },
  { operationName: 'UpdateTreasuryCashFloatCount' }
)
