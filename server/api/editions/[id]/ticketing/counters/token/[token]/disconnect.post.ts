import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { counterStreamManager } from '#server/utils/ticketing-counter-sse'
import { validateEditionId } from '#server/utils/validation-helpers'

const disconnectSchema = z.object({
  sessionId: z.string().min(1),
})

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    const body = await readBody(event)
    const { sessionId } = disconnectSchema.parse(body)

    // Vérifier que le compteur existe
    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        status: 404,
        message: 'Compteur introuvable',
      })
    }

    // Déconnecter la session spécifique
    const disconnected = counterStreamManager.disconnectSession(sessionId, editionId, counter.id)

    if (!disconnected) {
      console.log(`[Counter SSE] Tentative de déconnexion d'une session inexistante: ${sessionId}`)
    }

    return {
      success: true,
      disconnected,
      message: disconnected ? 'Session déconnectée' : 'Session déjà fermée',
    }
  },
  { operationName: 'POST disconnect ticketing counter by token' }
)
