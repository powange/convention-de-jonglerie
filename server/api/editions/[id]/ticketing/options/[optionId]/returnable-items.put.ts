import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  returnableItemIds: z.array(z.number().int().positive()),
})

/**
 * PUT /api/editions/[id]/ticketing/options/[optionId]/returnable-items
 *
 * Met à jour uniquement les articles à restituer associés à une option.
 * Remplace l'ensemble des associations existantes.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const optionId = validateResourceId(event, 'optionId', 'option')

    const allowed = await canAccessEditionData(editionId, user.id, event)
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

    const { returnableItemIds } = bodySchema.parse(await readBody(event))

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
      await tx.ticketingOptionReturnableItem.deleteMany({ where: { optionId } })
      if (returnableItemIds.length > 0) {
        await tx.ticketingOptionReturnableItem.createMany({
          data: returnableItemIds.map((returnableItemId) => ({ optionId, returnableItemId })),
        })
      }
    })

    return createSuccessResponse({ optionId, returnableItemIds })
  },
  { operationName: 'PUT ticketing option returnable-items' }
)
