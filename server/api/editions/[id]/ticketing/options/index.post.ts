import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { createOption } from '#server/utils/editions/ticketing/options'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string().min(1),
  isRequired: z.boolean().default(false),
  choices: z.array(z.string()).nullable().optional(),
  price: z.number().int().nullable().optional(), // Prix en centimes
  position: z.number().int().min(0).default(0),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
  tierIds: z.array(z.number().int()).optional().default([]),
  mealIds: z.array(z.number().int()).optional().default([]),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const body = bodySchema.parse(await readBody(event))
    const option = await createOption(editionId, body)

    return createSuccessResponse({ option })
  },
  { operationName: 'POST ticketing option' }
)
