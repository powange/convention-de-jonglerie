import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const requestId = validateResourceId(event, 'id', 'demande')

    // Vérifier que la demande existe et que l'utilisateur en est le créateur
    const existingRequest = await fetchResourceOrFail(prisma.carpoolRequest, requestId, {
      errorMessage: 'Demande de covoiturage introuvable',
    })

    // Seul le créateur peut supprimer sa demande
    if (existingRequest.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour supprimer cette demande",
      })
    }

    // Supprimer la demande (les commentaires seront supprimés automatiquement grâce à CASCADE)
    await prisma.carpoolRequest.delete({
      where: { id: requestId },
    })

    return { message: 'Demande de covoiturage supprimée avec succès' }
  },
  { operationName: 'DeleteCarpoolRequest' }
)
