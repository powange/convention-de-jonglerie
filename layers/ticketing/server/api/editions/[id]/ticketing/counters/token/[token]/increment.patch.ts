import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { notifyCounterUpdate } from '#server/utils/ticketing-counter-sse'
import { validateEditionId } from '#server/utils/validation-helpers'

const incrementSchema = z.object({
  step: z.number().int().positive().default(1),
})

export default wrapApiHandler(
  async (event) => {
    // Authentification requise mais pas de vérification de permissions
    // Les compteurs partagés via QR code sont accessibles à tous les utilisateurs authentifiés
    requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    const body = await readBody(event)
    const { step } = incrementSchema.parse(body)

    // Vérifier que le compteur existe
    const existingCounter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!existingCounter) {
      throw createError({
        status: 404,
        message: 'Compteur introuvable',
      })
    }

    // Incrémenter le compteur
    const counter = await prisma.ticketingCounter.update({
      where: { id: existingCounter.id },
      data: {
        value: {
          increment: step,
        },
      },
    })

    // Notifier les clients connectés
    notifyCounterUpdate(editionId, counter.id, counter.value, counter.updatedAt.toISOString())

    return createSuccessResponse({ counter })
  },
  { operationName: 'PATCH increment ticketing counter by token' }
)
