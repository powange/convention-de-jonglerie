import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  returnableItemIds: z.array(z.number().int().positive()),
})

/**
 * PUT /api/editions/[id]/ticketing/tiers/[tierId]/returnable-items
 *
 * Met à jour uniquement les articles à restituer associés à un tarif.
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

    const { returnableItemIds } = bodySchema.parse(await readBody(event))

    // Vérifier que tous les articles appartiennent à l'édition.
    if (returnableItemIds.length > 0) {
      const count = await prisma.ticketingReturnableItem.count({
        where: { id: { in: returnableItemIds }, editionId },
      })
      if (count !== returnableItemIds.length) {
        throw createError({
          status: 400,
          message: "Certains articles n'appartiennent pas à cette édition",
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticketingTierReturnableItem.deleteMany({ where: { tierId } })
      if (returnableItemIds.length > 0) {
        await tx.ticketingTierReturnableItem.createMany({
          data: returnableItemIds.map((returnableItemId) => ({ tierId, returnableItemId })),
        })
      }
    })

    return createSuccessResponse({ tierId, returnableItemIds })
  },
  { operationName: 'PUT ticketing tier returnable-items' }
)
