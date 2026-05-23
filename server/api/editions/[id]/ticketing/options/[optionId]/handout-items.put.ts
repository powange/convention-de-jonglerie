import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  handoutItemIds: z.array(z.number().int().positive()),
})

/**
 * PUT /api/editions/[id]/ticketing/options/[optionId]/handout-items
 *
 * Met à jour uniquement les articles à remettre associés à une option.
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

    const { handoutItemIds } = bodySchema.parse(await readBody(event))

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
      await tx.ticketingOptionHandoutItem.deleteMany({ where: { optionId } })
      if (handoutItemIds.length > 0) {
        await tx.ticketingOptionHandoutItem.createMany({
          data: handoutItemIds.map((handoutItemId) => ({ optionId, handoutItemId })),
        })
      }
    })

    return createSuccessResponse({ optionId, handoutItemIds })
  },
  { operationName: 'PUT ticketing option handout-items' }
)
