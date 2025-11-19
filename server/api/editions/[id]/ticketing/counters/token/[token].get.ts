import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise mais pas de vérification de permissions
    // Les compteurs partagés via QR code sont accessibles à tous les utilisateurs authentifiés
    requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        statusCode: 404,
        message: 'Compteur introuvable',
      })
    }

    return {
      success: true,
      counter,
    }
  },
  { operationName: 'GET ticketing counter by token' }
)
