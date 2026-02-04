import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Retourne le statut de la candidature bénévole de l'utilisateur connecté pour une édition
 * Route optimisée pour vérifier rapidement si l'utilisateur est un bénévole accepté
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer uniquement le statut de la candidature
    const application = await prisma.editionVolunteerApplication.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
      select: {
        status: true,
      },
    })

    // Retourner le statut ou null si pas de candidature
    return {
      status: application?.status || null,
    }
  },
  { operationName: 'GetVolunteerApplicationStatus' }
)
