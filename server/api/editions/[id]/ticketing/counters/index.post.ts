import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const createCounterSchema = z.object({
  name: z.string().min(1, 'Le nom du compteur est requis').max(100),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour créer un compteur',
      })
    }

    const body = await readBody(event)
    const { name } = createCounterSchema.parse(body)

    const counter = await prisma.ticketingCounter.create({
      data: {
        editionId,
        name,
        value: 0,
      },
    })

    return createSuccessResponse({ counter })
  },
  { operationName: 'POST create ticketing counter' }
)
