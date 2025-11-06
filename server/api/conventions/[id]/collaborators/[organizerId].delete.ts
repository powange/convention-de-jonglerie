import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteConventionOrganizer } from '@@/server/utils/collaborator-management'
import { validateConventionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)
    const organizerId = validateResourceId(event, 'organizerId', 'organisateur')

    // Utiliser l'utilitaire de suppression en passant l'event pour vérifier le mode admin
    const result = await deleteConventionOrganizer(conventionId, organizerId, user.id, event)

    return {
      success: result.success,
      message: result.message,
    }
  },
  { operationName: 'DeleteConventionOrganizer' }
)
