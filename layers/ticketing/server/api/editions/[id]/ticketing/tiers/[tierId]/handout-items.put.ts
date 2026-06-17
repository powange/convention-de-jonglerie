import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  handoutItemIds: z.array(z.number().int().positive()),
})

/**
 * PUT /api/editions/[id]/ticketing/tiers/[tierId]/handout-items
 *
 * Met à jour uniquement les articles à remettre associés à un tarif.
 * Remplace l'ensemble des associations existantes.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const tierId = validateResourceId(event, 'tierId', 'tier')

    const allowed = await canAccessEditionData(editionId, user.id, event)
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

    const { handoutItemIds } = bodySchema.parse(await readBody(event))

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
      await tx.ticketingTierHandoutItem.deleteMany({ where: { tierId } })
      if (handoutItemIds.length > 0) {
        await tx.ticketingTierHandoutItem.createMany({
          data: handoutItemIds.map((handoutItemId) => ({ tierId, handoutItemId })),
        })
      }
    })

    return createSuccessResponse({ tierId, handoutItemIds })
  },
  { operationName: 'PUT ticketing tier handout-items' }
)
