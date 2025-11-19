import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { broadcastCounterUpdate } from '@@/server/utils/ticketing-counter-sse'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const incrementSchema = z.object({
  step: z.number().int().positive().default(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const counterId = validateResourceId(event, 'counterId', 'compteur')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour modifier ce compteur',
      })
    }

    const body = await readBody(event)
    const { step } = incrementSchema.parse(body)

    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        id: counterId,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        statusCode: 404,
        message: 'Compteur introuvable',
      })
    }

    const updatedCounter = await prisma.ticketingCounter.update({
      where: {
        id: counterId,
      },
      data: {
        value: {
          increment: step,
        },
      },
    })

    // Diffuser la mise à jour via SSE
    broadcastCounterUpdate(editionId, counterId, updatedCounter)

    return {
      success: true,
      counter: updatedCounter,
    }
  },
  { operationName: 'PATCH increment counter' }
)
