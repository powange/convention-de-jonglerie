import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { notifyCounterUpdate } from '@@/server/utils/ticketing-counter-sse'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const decrementSchema = z.object({
  step: z.number().int().positive().default(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour modifier ce compteur',
      })
    }

    const body = await readBody(event)
    const { step } = decrementSchema.parse(body)

    // Vérifier que le compteur existe
    const existingCounter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!existingCounter) {
      throw createError({
        statusCode: 404,
        message: 'Compteur introuvable',
      })
    }

    // Décrémenter le compteur (ne peut pas descendre sous 0)
    const newValue = Math.max(0, existingCounter.value - step)
    const counter = await prisma.ticketingCounter.update({
      where: { id: existingCounter.id },
      data: {
        value: newValue,
      },
    })

    // Notifier les clients connectés
    notifyCounterUpdate(editionId, counter.id, counter.value, counter.updatedAt.toISOString())

    return {
      success: true,
      counter,
    }
  },
  { operationName: 'PATCH decrement ticketing counter by token' }
)
