import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const counterId = getRouterParam(event, 'counterId')

    if (!counterId) {
      throw createError({
        statusCode: 400,
        message: 'ID du compteur manquant',
      })
    }

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour régénérer le token de ce compteur',
      })
    }

    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        token: counterId,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        statusCode: 404,
        message: 'Compteur introuvable',
      })
    }

    // Générer un nouveau token unique
    const newToken = crypto.randomUUID()

    // Mettre à jour le token du compteur existant
    const updatedCounter = await prisma.ticketingCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        token: newToken,
        updatedAt: new Date(),
      },
    })

    return {
      success: true,
      token: newToken,
      counter: updatedCounter,
    }
  },
  { operationName: 'PATCH regenerate ticketing counter token' }
)
