import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/options/[optionId]/quotas
 *
 * Met à jour UNIQUEMENT les quotas associés à une option. Remplace l'ensemble des associations.
 *
 * Jumeau de `/tiers/[tierId]/quotas`, et pour la même raison : le PUT générique d'une option
 * réécrit les repas sans condition (`mealIds || []`) et exige le nom, le type et la position. Un
 * appel qui ne porterait que les quotas effacerait donc les repas de l'option, silencieusement.
 *
 * Avec cet endpoint, les quotas n'ont plus qu'un seul chemin d'écriture — ce qui est tout l'objet
 * de leur page dédiée.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const optionId = validateResourceId(event, 'optionId', 'option')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const option = await prisma.ticketingOption.findFirst({
      where: { id: optionId, editionId },
      select: { id: true },
    })
    if (!option) {
      throw createError({ status: 404, message: 'Option introuvable' })
    }

    const body = bodySchema.parse(await readBody(event))
    // Un même quota envoyé deux fois violerait l'unicité du couple (option, quota) : on déduplique
    // plutôt que de laisser la base refuser une saisie qui n'a rien d'aberrant côté écran.
    const quotaIds = [...new Set(body.quotaIds)]

    // Les quotas doivent appartenir à cette édition — sans quoi on rattacherait une option à la
    // jauge d'une autre convention.
    if (quotaIds.length > 0) {
      const nombre = await prisma.ticketingQuota.count({
        where: { id: { in: quotaIds }, editionId },
      })
      if (nombre !== quotaIds.length) {
        throw createError({
          status: 400,
          message: "Certains quotas n'appartiennent pas à cette édition",
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticketingOptionQuota.deleteMany({ where: { optionId } })
      if (quotaIds.length > 0) {
        await tx.ticketingOptionQuota.createMany({
          data: quotaIds.map((quotaId) => ({ optionId, quotaId })),
        })
      }
    })

    return createSuccessResponse({ optionId, quotaIds })
  },
  { operationName: 'PUT ticketing option quotas' }
)
