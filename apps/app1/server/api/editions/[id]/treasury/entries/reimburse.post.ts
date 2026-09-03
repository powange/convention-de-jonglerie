import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  advancedById: z.number().int().positive(),
})

/**
 * POST /api/editions/:id/treasury/entries/reimburse — solde toutes les avances d'une personne.
 *
 * Rembourser se fait en un versement : pointer les lignes une par une était le geste le plus
 * fastidieux de la page, et le plus facile à laisser à moitié fait.
 *
 * Le lot mis à jour est EXACTEMENT celui que totalise la carte « À rembourser » — dépenses de
 * cette personne, non remboursées, non prévisionnelles. Marquer une avance prévisionnelle serait
 * incohérent : elle n'entrait pas dans le montant qu'on vient de verser, puisque rien n'était
 * encore sorti de la poche de personne.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const { advancedById } = bodySchema.parse(await readBody(event))

    const { count } = await prisma.treasuryEntry.updateMany({
      where: {
        editionId,
        kind: 'EXPENSE',
        advancedById,
        reimbursed: false,
        isForecast: false,
      },
      data: { reimbursed: true },
    })

    return createSuccessResponse({ count })
  },
  { operationName: 'ReimburseTreasuryAdvances' }
)
