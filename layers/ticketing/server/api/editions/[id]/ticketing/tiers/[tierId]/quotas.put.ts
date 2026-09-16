import { z } from 'zod'

import { assertQuotasDeLEdition } from '../../../../../../utils/quotas-appartenance'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/tiers/[tierId]/quotas
 *
 * Met à jour UNIQUEMENT les quotas associés à un tarif. Remplace l'ensemble des associations.
 *
 * Pourquoi un endpoint dédié plutôt que le PUT du tarif : celui-ci réécrit les repas sans
 * condition (`mealIds || []` dans `updateTier`) et exige le nom et le prix. Un appel qui ne
 * porterait que les quotas effacerait donc les repas du tarif, silencieusement. C'est exactement
 * la raison pour laquelle les articles à remettre ont déjà leur propre endpoint, juste à côté —
 * on suit le même chemin plutôt que d'en inventer un second.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const tierId = validateResourceId(event, 'tierId', 'tier')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const tier = await prisma.ticketingTier.findFirst({
      where: { id: tierId, editionId },
      select: { id: true },
    })
    if (!tier) {
      throw createError({ status: 404, message: 'Tarif introuvable' })
    }

    const body = bodySchema.parse(await readBody(event))
    // Un même quota envoyé deux fois violerait l'unicité du couple (tarif, quota) : on déduplique
    // plutôt que de laisser la base refuser une saisie qui n'a rien d'aberrant côté écran.
    const quotaIds = [...new Set(body.quotaIds)]

    await assertQuotasDeLEdition(editionId, quotaIds)

    await prisma.$transaction(async (tx) => {
      await tx.ticketingTierQuota.deleteMany({ where: { tierId } })
      if (quotaIds.length > 0) {
        await tx.ticketingTierQuota.createMany({
          data: quotaIds.map((quotaId) => ({ tierId, quotaId })),
        })
      }
    })

    return createSuccessResponse({ tierId, quotaIds })
  },
  { operationName: 'PUT ticketing tier quotas' }
)
