import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

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
        message: 'Droits insuffisants pour supprimer ce compteur',
      })
    }

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

    await prisma.ticketingCounter.delete({
      where: {
        id: counterId,
      },
    })

    return {
      success: true,
      message: 'Compteur supprimé avec succès',
    }
  },
  { operationName: 'DELETE ticketing counter' }
)
