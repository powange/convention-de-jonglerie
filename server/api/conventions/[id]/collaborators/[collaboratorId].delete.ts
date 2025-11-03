import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteConventionCollaborator } from '@@/server/utils/collaborator-management'
import { validateConventionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)
    const collaboratorId = validateResourceId(event, 'collaboratorId', 'collaborateur')

    // Utiliser l'utilitaire de suppression
    const result = await deleteConventionCollaborator(conventionId, collaboratorId, user.id)

    return {
      success: result.success,
      message: result.message,
    }
  },
  { operationName: 'DeleteConventionCollaborator' }
)
